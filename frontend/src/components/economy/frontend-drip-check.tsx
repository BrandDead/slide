import React, { useState, useEffect } from 'react';
import { Camera, Upload, Search, Sparkles, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  verified: boolean;
  category: string;
}

interface SubmissionStatus {
  id: number;
  status: 'pending' | 'processing' | 'verified' | 'rejected' | 'needs_review';
  brand_name: string;
  item_name: string;
  detected_brand?: string;
  brand_confidence?: number;
  reward_type?: string;
  rejection_reason?: string;
  created_at: string;
}

export const DripCheck: React.FC = () => {
  const [step, setStep] = useState<'search' | 'upload' | 'processing' | 'result'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [existingBrands, setExistingBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  
  // Upload states
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  
  // Submission tracking
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus | null>(null);
  const [mySubmissions, setMySubmissions] = useState<SubmissionStatus[]>([]);

  // Search existing brands
  const searchBrands = async (query: string) => {
    if (query.length < 2) {
      setExistingBrands([]);
      return;
    }

    try {
      const response = await fetch(`/api/drip/brands/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setExistingBrands(data.brands || []);
    } catch (error) {
      console.error('Brand search failed:', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchBrands(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Real-time brand verification
  const verifyNewBrand = async (brandName: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/drip/brands/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: brandName })
      });
      
      const data = await response.json();
      
      if (data.verified) {
        // Brand exists online and was auto-added to catalog
        setSelectedBrand(data.brand);
        return true;
      } else if (data.requires_review) {
        // Brand needs manual verification but submission can continue
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Brand verification failed:', error);
      return false;
    }
  };

  // Handle brand selection or new brand entry
  const handleBrandContinue = async () => {
    if (!selectedBrand && !newBrandName) {
      alert('Please select or enter a brand name');
      return;
    }

    if (newBrandName && !selectedBrand) {
      // New brand - verify in real-time
      setStep('processing');
      const verified = await verifyNewBrand(newBrandName);
      
      if (!verified) {
        alert('Could not verify brand. Submission will be manually reviewed.');
      }
    }
    
    setStep('upload');
  };

  // Submit drip check
  const submitDripCheck = async () => {
    if (!receiptImage || !itemImage) {
      alert('Please upload both receipt and item photos');
      return;
    }

    setStep('processing');

    const formData = new FormData();
    formData.append('receipt_image', receiptImage);
    formData.append('item_image', itemImage);
    formData.append('brand_name', selectedBrand?.name || newBrandName);
    formData.append('item_name', itemName);
    formData.append('category', category);
    formData.append('purchase_price', purchasePrice);

    try {
      const response = await fetch('/api/drip/submit', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      setSubmissionId(data.submission_id);
      setSubmissionStatus(data);
      
      // Start polling for status updates
      pollSubmissionStatus(data.submission_id);
      
      setStep('result');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to submit. Please try again.');
      setStep('upload');
    }
  };

  // Poll for submission status updates
  const pollSubmissionStatus = (subId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/drip/submission/${subId}`);
        const data = await response.json();
        
        setSubmissionStatus(data);
        
        // Stop polling if verified or rejected
        if (data.status === 'verified' || data.status === 'rejected') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Clear after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  };

  // Fetch user's previous submissions
  useEffect(() => {
    fetch('/api/drip/my-submissions')
      .then(res => res.json())
      .then(data => setMySubmissions(data.submissions || []))
      .catch(console.error);
  }, []);

  return (
    <div className="drip-check-container p-6 max-w-2xl mx-auto">
      <div className="header mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="text-yellow-500" />
          Drip Check
        </h1>
        <p className="text-gray-400 mt-2">
          Prove your real-world drip, unlock exclusive in-game items
        </p>
      </div>

      {/* Step 1: Brand Search/Selection */}
      {step === 'search' && (
        <div className="brand-search space-y-4">
          <div className="search-box">
            <label className="block text-sm font-medium mb-2">
              What brand did you cop?
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setNewBrandName(e.target.value);
                  setSelectedBrand(null);
                }}
                placeholder="Search brands... (e.g., Amiri, Supreme, Nike)"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Existing brands list */}
          {existingBrands.length > 0 && (
            <div className="brands-list space-y-2">
              <p className="text-sm text-gray-400">Found in catalog:</p>
              {existingBrands.map(brand => (
                <div
                  key={brand.id}
                  onClick={() => {
                    setSelectedBrand(brand);
                    setSearchQuery(brand.name);
                  }}
                  className={`brand-card p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedBrand?.id === brand.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {brand.logo_url && (
                      <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{brand.name}</h3>
                        {brand.verified && (
                          <CheckCircle className="text-blue-500" size={16} />
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{brand.category}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New brand option */}
          {searchQuery.length > 2 && existingBrands.length === 0 && (
            <div className="new-brand-card p-4 rounded-lg border border-dashed border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-3">
                <Sparkles className="text-yellow-500" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold">
                    Add "{searchQuery}" to catalog
                  </h3>
                  <p className="text-sm text-gray-400">
                    We'll verify this brand in real-time
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleBrandContinue}
            disabled={!selectedBrand && !newBrandName}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Upload Proof */}
      {step === 'upload' && (
        <div className="upload-section space-y-6">
          <div className="selected-brand p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Brand:</p>
            <h3 className="text-xl font-bold">{selectedBrand?.name || newBrandName}</h3>
          </div>

          {/* Item details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Item Name</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., MX1 Leather Patch Jeans"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select category</option>
                <option value="jeans">Jeans</option>
                <option value="jacket">Jacket</option>
                <option value="shoes">Shoes</option>
                <option value="shirt">Shirt</option>
                <option value="accessories">Accessories</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Purchase Price ($)</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="890"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Receipt upload */}
          <div className="upload-box">
            <label className="block text-sm font-medium mb-2">Receipt Photo</label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReceiptImage(e.target.files?.[0] || null)}
                className="hidden"
                id="receipt-upload"
              />
              <label htmlFor="receipt-upload" className="cursor-pointer">
                {receiptImage ? (
                  <div className="space-y-2">
                    <CheckCircle className="mx-auto text-green-500" size={40} />
                    <p className="text-sm">{receiptImage.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto text-gray-400" size={40} />
                    <p className="text-sm text-gray-400">
                      Upload your receipt or order confirmation
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Item photo upload */}
          <div className="upload-box">
            <label className="block text-sm font-medium mb-2">Item Photo</label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setItemImage(e.target.files?.[0] || null)}
                className="hidden"
                id="item-upload"
              />
              <label htmlFor="item-upload" className="cursor-pointer">
                {itemImage ? (
                  <div className="space-y-2">
                    <CheckCircle className="mx-auto text-green-500" size={40} />
                    <p className="text-sm">{itemImage.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="mx-auto text-gray-400" size={40} />
                    <p className="text-sm text-gray-400">
                      Take a photo of your item with tags (if possible)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('search')}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              onClick={submitDripCheck}
              disabled={!receiptImage || !itemImage || !itemName || !category}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              Submit for Verification
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <div className="processing text-center space-y-6">
          <div className="spinner mx-auto w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <h3 className="text-xl font-bold mb-2">Verifying your drip...</h3>
            <p className="text-gray-400">
              Our AI is analyzing your receipt and item photos
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && submissionStatus && (
        <div className="result space-y-6">
          {submissionStatus.status === 'processing' && (
            <div className="status-card p-6 bg-blue-500/10 border border-blue-500 rounded-lg">
              <div className="flex items-center gap-4">
                <Clock className="text-blue-500" size={40} />
                <div>
                  <h3 className="text-xl font-bold">Verification in Progress</h3>
                  <p className="text-gray-400">
                    This usually takes 30-60 seconds. We'll notify you when it's done!
                  </p>
                </div>
              </div>
            </div>
          )}

          {submissionStatus.status === 'verified' && (
            <div className="status-card p-6 bg-green-500/10 border border-green-500 rounded-lg">
              <div className="flex items-center gap-4">
                <CheckCircle className="text-green-500" size={40} />
                <div>
                  <h3 className="text-xl font-bold">Drip Verified! 🔥</h3>
                  <p className="text-gray-400">
                    Your {submissionStatus.brand_name} {submissionStatus.item_name} has been unlocked!
                  </p>
                  {submissionStatus.reward_type && (
                    <p className="text-sm mt-2 text-green-400">
                      Reward: {submissionStatus.reward_type}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {submissionStatus.status === 'needs_review' && (
            <div className="status-card p-6 bg-yellow-500/10 border border-yellow-500 rounded-lg">
              <div className="flex items-center gap-4">
                <AlertCircle className="text-yellow-500" size={40} />
                <div>
                  <h3 className="text-xl font-bold">Manual Review Required</h3>
                  <p className="text-gray-400">
                    Our team is reviewing your submission. This usually takes 24-48 hours.
                  </p>
                  {submissionStatus.detected_brand && (
                    <p className="text-sm mt-2">
                      Detected: {submissionStatus.detected_brand}
                      {submissionStatus.brand_confidence && (
                        <span className="ml-2 text-gray-500">
                          ({(submissionStatus.brand_confidence * 100).toFixed(0)}% confidence)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {submissionStatus.status === 'rejected' && (
            <div className="status-card p-6 bg-red-500/10 border border-red-500 rounded-lg">
              <div className="flex items-center gap-4">
                <AlertCircle className="text-red-500" size={40} />
                <div>
                  <h3 className="text-xl font-bold">Submission Rejected</h3>
                  <p className="text-gray-400">
                    {submissionStatus.rejection_reason || 'Could not verify item authenticity'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setStep('search');
              setSearchQuery('');
              setSelectedBrand(null);
              setNewBrandName('');
              setReceiptImage(null);
              setItemImage(null);
              setItemName('');
              setCategory('');
              setPurchasePrice('');
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Submit Another Item
          </button>
        </div>
      )}

      {/* Previous Submissions */}
      {mySubmissions.length > 0 && step === 'search' && (
        <div className="previous-submissions mt-12">
          <h2 className="text-xl font-bold mb-4">Your Submissions</h2>
          <div className="space-y-3">
            {mySubmissions.slice(0, 5).map(sub => (
              <div
                key={sub.id}
                className="submission-card p-4 bg-gray-800 rounded-lg flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold">{sub.brand_name} - {sub.item_name}</h3>
                  <p className="text-sm text-gray-400">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`status-badge px-3 py-1 rounded-full text-sm ${
                  sub.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                  sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                  sub.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {sub.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DripCheck;
