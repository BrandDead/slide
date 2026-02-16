import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, ZoomIn } from 'lucide-react';

interface Submission {
  id: number;
  user_id: number;
  brand_name: string;
  item_name: string;
  category: string;
  purchase_price: number;
  receipt_image_url: string;
  item_image_url: string;
  brand_confidence: number;
  detected_brand: string;
  status: string;
  created_at: string;
  ocr_data?: any;
}

export const DripCheckAdmin: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('needs_review');
  const [loading, setLoading] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  
  useEffect(() => {
    loadSubmissions();
  }, [filterStatus]);
  
  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/drip/admin/pending?status=${filterStatus}`);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const reviewSubmission = async (submissionId: number, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/drip/admin/review/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'reject' ? reviewReason : null
        })
      });
      
      if (response.ok) {
        // Remove from list
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));
        setSelectedSubmission(null);
        setReviewReason('');
        
        alert(`Submission ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      }
    } catch (error) {
      console.error('Review failed:', error);
      alert('Failed to process review');
    }
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  const getStatusBadge = (status: string) => {
    const colors = {
      needs_review: 'bg-yellow-500/20 text-yellow-500',
      processing: 'bg-blue-500/20 text-blue-500',
      verified: 'bg-green-500/20 text-green-500',
      rejected: 'bg-red-500/20 text-red-500'
    };
    
    return colors[status] || 'bg-gray-500/20 text-gray-500';
  };

  return (
    <div className="admin-dashboard p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="header mb-8">
        <h1 className="text-3xl font-bold mb-4">Drip Check Admin Dashboard</h1>
        
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setFilterStatus('needs_review')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filterStatus === 'needs_review'
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            Needs Review ({submissions.filter(s => s.status === 'needs_review').length})
          </button>
          <button
            onClick={() => setFilterStatus('processing')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filterStatus === 'processing'
                ? 'bg-blue-500 text-black'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filterStatus === 'all'
                ? 'bg-gray-500 text-white'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            All Submissions
          </button>
        </div>
        
        {/* Stats */}
        <div className="stats grid grid-cols-4 gap-4 mb-6">
          <div className="stat-card p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-yellow-500">
              {submissions.filter(s => s.status === 'needs_review').length}
            </div>
            <div className="text-sm text-gray-400">Pending Review</div>
          </div>
          <div className="stat-card p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">
              {submissions.filter(s => s.status === 'processing').length}
            </div>
            <div className="text-sm text-gray-400">Auto-Processing</div>
          </div>
          <div className="stat-card p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {submissions.filter(s => s.status === 'verified').length}
            </div>
            <div className="text-sm text-gray-400">Verified Today</div>
          </div>
          <div className="stat-card p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-red-500">
              {submissions.filter(s => s.status === 'rejected').length}
            </div>
            <div className="text-sm text-gray-400">Rejected Today</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Submissions List */}
        <div className="submissions-list space-y-3">
          <h2 className="text-xl font-bold mb-4">Submissions Queue</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No submissions in this category
            </div>
          ) : (
            submissions.map(submission => (
              <div
                key={submission.id}
                onClick={() => setSelectedSubmission(submission)}
                className={`submission-card p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedSubmission?.id === submission.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{submission.brand_name}</h3>
                    <p className="text-sm text-gray-400">{submission.item_name}</p>
                  </div>
                  <div className={`status-badge px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(submission.status)}`}>
                    {submission.status}
                  </div>
                </div>
                
                <div className="details grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Category:</span> {submission.category}
                  </div>
                  <div>
                    <span className="text-gray-400">Price:</span> ${submission.purchase_price}
                  </div>
                  <div>
                    <span className="text-gray-400">Detected:</span> {submission.detected_brand || 'N/A'}
                  </div>
                  <div>
                    <span className={`text-gray-400`}>Confidence:</span>{' '}
                    <span className={getConfidenceColor(submission.brand_confidence || 0)}>
                      {((submission.brand_confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mt-2">
                  Submitted: {new Date(submission.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail View */}
        <div className="detail-view sticky top-6">
          {selectedSubmission ? (
            <div className="detail-card bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Review Submission #{selectedSubmission.id}</h2>
              
              {/* Submission Info */}
              <div className="info-section mb-6">
                <h3 className="text-lg font-semibold mb-3">Submission Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Brand:</span>
                    <span className="font-medium">{selectedSubmission.brand_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Item:</span>
                    <span className="font-medium">{selectedSubmission.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Category:</span>
                    <span>{selectedSubmission.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price:</span>
                    <span>${selectedSubmission.purchase_price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">User ID:</span>
                    <span>{selectedSubmission.user_id}</span>
                  </div>
                </div>
              </div>
              
              {/* AI Analysis */}
              <div className="ai-section mb-6">
                <h3 className="text-lg font-semibold mb-3">AI Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Detected Brand:</span>
                    <span className="font-medium">{selectedSubmission.detected_brand || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Confidence:</span>
                    <span className={getConfidenceColor(selectedSubmission.brand_confidence || 0)}>
                      {((selectedSubmission.brand_confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  {selectedSubmission.ocr_data && (
                    <div className="mt-2">
                      <span className="text-gray-400">Receipt Data:</span>
                      <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(selectedSubmission.ocr_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Images */}
              <div className="images-section mb-6">
                <h3 className="text-lg font-semibold mb-3">Submitted Photos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Receipt</p>
                    <a
                      href={selectedSubmission.receipt_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square bg-gray-900 rounded-lg overflow-hidden hover:ring-2 ring-blue-500 transition-all"
                    >
                      <img
                        src={selectedSubmission.receipt_image_url}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Item Photo</p>
                    <a
                      href={selectedSubmission.item_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square bg-gray-900 rounded-lg overflow-hidden hover:ring-2 ring-blue-500 transition-all"
                    >
                      <img
                        src={selectedSubmission.item_image_url}
                        alt="Item"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Review Actions */}
              {selectedSubmission.status === 'needs_review' && (
                <div className="actions-section">
                  <h3 className="text-lg font-semibold mb-3">Review Actions</h3>
                  
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="Add reason (optional for approval, required for rejection)"
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg mb-4 text-sm focus:border-blue-500 focus:outline-none"
                    rows={3}
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => reviewSubmission(selectedSubmission.id, 'approve')}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle size={20} />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        if (!reviewReason.trim()) {
                          alert('Please provide a rejection reason');
                          return;
                        }
                        reviewSubmission(selectedSubmission.id, 'reject');
                      }}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <XCircle size={20} />
                      Reject
                    </button>
                  </div>
                </div>
              )}
              
              {selectedSubmission.status !== 'needs_review' && (
                <div className="text-center py-4 text-gray-400">
                  This submission has been {selectedSubmission.status}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state bg-gray-800 rounded-lg p-12 text-center text-gray-400">
              <Eye size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a submission to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DripCheckAdmin;
