"""
OCR Service for Receipt Processing
Extracts text from receipts and validates purchase information
"""

import re
from typing import Dict, List, Optional
from datetime import datetime, timedelta


class OCRService:
    """
    Extract and validate receipt information using OCR
    Supports multiple OCR backends
    """
    
    def __init__(self, use_cloud_vision: bool = False):
        self.use_cloud_vision = use_cloud_vision
        
        # Initialize OCR engine
        if use_cloud_vision:
            # Google Cloud Vision API (best accuracy, paid)
            try:
                from google.cloud import vision
                self.vision_client = vision.ImageAnnotatorClient()
            except ImportError:
                print("Google Cloud Vision not available, falling back to Tesseract")
                self.use_cloud_vision = False
        
        if not use_cloud_vision:
            # Tesseract OCR (free, decent accuracy)
            try:
                import pytesseract
                from PIL import Image
                self.pytesseract = pytesseract
                self.Image = Image
            except ImportError:
                print("Warning: No OCR engine available")
    
    def extract_receipt_data(self, image_path: str) -> Dict:
        """
        Main method to extract all data from receipt
        
        Returns:
            {
                'raw_text': str,
                'merchant_name': str,
                'total_amount': float,
                'date': str,
                'items': list,
                'brand_mentions': list,
                'price_match': bool,
                'confidence': float
            }
        """
        # Extract text using appropriate OCR engine
        raw_text = self._extract_text(image_path)
        
        if not raw_text:
            return {
                'error': 'Could not extract text from image',
                'confidence': 0.0
            }
        
        # Parse receipt data
        parsed_data = self._parse_receipt(raw_text)
        
        return parsed_data
    
    def _extract_text(self, image_path: str) -> str:
        """Extract raw text from image"""
        if self.use_cloud_vision:
            return self._extract_with_cloud_vision(image_path)
        else:
            return self._extract_with_tesseract(image_path)
    
    def _extract_with_tesseract(self, image_path: str) -> str:
        """Extract text using Tesseract OCR"""
        try:
            image = self.Image.open(image_path)
            text = self.pytesseract.image_to_string(image)
            return text
        except Exception as e:
            print(f"Tesseract OCR error: {e}")
            return ""
    
    def _extract_with_cloud_vision(self, image_path: str) -> str:
        """Extract text using Google Cloud Vision API"""
        try:
            with open(image_path, 'rb') as image_file:
                content = image_file.read()
            
            image = self.vision_client.image(content=content)
            response = self.vision_client.text_detection(image=image)
            
            if response.text_annotations:
                return response.text_annotations[0].description
            
            return ""
        except Exception as e:
            print(f"Cloud Vision error: {e}")
            return ""
    
    def _parse_receipt(self, raw_text: str) -> Dict:
        """Parse receipt text into structured data"""
        data = {
            'raw_text': raw_text,
            'merchant_name': None,
            'total_amount': None,
            'date': None,
            'items': [],
            'brand_mentions': [],
            'price_match': False,
            'confidence': 0.0
        }
        
        lines = raw_text.split('\n')
        
        # Extract merchant (usually first few lines)
        merchant = self._extract_merchant(lines[:5])
        if merchant:
            data['merchant_name'] = merchant
            data['confidence'] += 0.2
        
        # Extract total amount
        total = self._extract_total_amount(raw_text)
        if total:
            data['total_amount'] = total
            data['confidence'] += 0.3
        
        # Extract date
        date = self._extract_date(raw_text)
        if date:
            data['date'] = date
            data['confidence'] += 0.2
            
            # Check if recent (within 90 days)
            if self._is_recent_purchase(date):
                data['confidence'] += 0.1
        
        # Extract line items
        items = self._extract_line_items(lines)
        data['items'] = items
        if items:
            data['confidence'] += 0.2
        
        return data
    
    def _extract_merchant(self, header_lines: List[str]) -> Optional[str]:
        """Extract merchant name from receipt header"""
        common_stores = [
            'nordstrom', 'bloomingdales', 'saks', 'neiman marcus',
            'barneys', 'ssense', 'farfetch', 'mrporter', 'end clothing',
            'grailed', 'stockx', 'goat', 'stadium goods',
            'nike', 'adidas', 'footlocker', 'finish line',
            'zara', 'h&m', 'uniqlo', 'urban outfitters'
        ]
        
        for line in header_lines:
            line_lower = line.lower().strip()
            for store in common_stores:
                if store in line_lower:
                    return store.title()
        
        # If no match, return first non-empty line
        for line in header_lines:
            if line.strip() and len(line.strip()) > 3:
                return line.strip()
        
        return None
    
    def _extract_total_amount(self, text: str) -> Optional[float]:
        """Extract total purchase amount"""
        # Look for patterns like:
        # TOTAL: $123.45
        # Total: 123.45
        # Grand Total $123.45
        
        patterns = [
            r'total[:\s]+\$?(\d+\.?\d*)',
            r'grand\s+total[:\s]+\$?(\d+\.?\d*)',
            r'amount\s+due[:\s]+\$?(\d+\.?\d*)',
            r'balance[:\s]+\$?(\d+\.?\d*)'
        ]
        
        text_lower = text.lower()
        
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                try:
                    # Get the last match (usually the final total)
                    amount = float(matches[-1])
                    if 0 < amount < 10000:  # Reasonable range
                        return amount
                except ValueError:
                    continue
        
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract purchase date"""
        # Common date formats:
        # 12/25/2023
        # 25-12-2023
        # December 25, 2023
        # 2023-12-25
        
        date_patterns = [
            r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})',
            r'((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})'
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                return matches[0]
        
        return None
    
    def _is_recent_purchase(self, date_str: str) -> bool:
        """Check if purchase is within last 90 days"""
        try:
            # Try to parse various date formats
            for fmt in ['%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d', '%B %d, %Y']:
                try:
                    purchase_date = datetime.strptime(date_str, fmt)
                    days_ago = (datetime.now() - purchase_date).days
                    return 0 <= days_ago <= 90
                except ValueError:
                    continue
        except Exception:
            pass
        
        return False
    
    def _extract_line_items(self, lines: List[str]) -> List[Dict]:
        """Extract individual items from receipt"""
        items = []
        
        # Look for lines with price patterns
        price_pattern = r'\$?(\d+\.?\d*)'
        
        for line in lines:
            # Skip empty lines and headers
            if not line.strip() or len(line.strip()) < 3:
                continue
            
            # Look for item name + price pattern
            if re.search(r'\d+\.?\d+', line):
                # Extract item name (everything before the price)
                parts = line.split()
                if len(parts) >= 2:
                    # Last part is likely the price
                    price_match = re.search(r'\$?(\d+\.?\d+)', parts[-1])
                    if price_match:
                        item_name = ' '.join(parts[:-1])
                        price = float(price_match.group(1))
                        
                        items.append({
                            'name': item_name.strip(),
                            'price': price
                        })
        
        return items
    
    def validate_price(self, extracted_price: Optional[float], 
                      claimed_price: float, 
                      tolerance: float = 0.1) -> bool:
        """
        Validate that extracted price matches claimed price
        
        Args:
            extracted_price: Price found on receipt
            claimed_price: Price claimed by user
            tolerance: Acceptable price difference (default 10%)
        """
        if not extracted_price:
            return False
        
        difference = abs(extracted_price - claimed_price)
        tolerance_amount = claimed_price * tolerance
        
        return difference <= tolerance_amount
    
    def extract_brand_from_receipt(self, raw_text: str, 
                                   expected_brand: str) -> Dict:
        """
        Check if specific brand is mentioned on receipt
        
        Returns:
            {
                'found': bool,
                'mentions': int,
                'confidence': float
            }
        """
        text_lower = raw_text.lower()
        brand_lower = expected_brand.lower()
        
        # Count exact matches
        exact_matches = text_lower.count(brand_lower)
        
        # Check for partial matches
        brand_words = brand_lower.split()
        partial_matches = sum(text_lower.count(word) for word in brand_words)
        
        found = exact_matches > 0 or partial_matches >= len(brand_words)
        
        confidence = min(1.0, (exact_matches * 0.5) + (partial_matches * 0.1))
        
        return {
            'found': found,
            'mentions': exact_matches,
            'confidence': confidence
        }


# Example usage for testing
if __name__ == '__main__':
    ocr = OCRService()
    
    # Test with sample receipt text
    sample_receipt = """
    NORDSTROM
    Downtown Store
    123 Main Street
    
    Date: 12/15/2024
    
    AMIRI MX1 JEANS          $890.00
    Tax                       $71.20
    
    TOTAL:                   $961.20
    
    Thank you for shopping!
    """
    
    result = ocr._parse_receipt(sample_receipt)
    print("Parsed receipt:")
    print(f"Merchant: {result['merchant_name']}")
    print(f"Total: ${result['total_amount']}")
    print(f"Date: {result['date']}")
    print(f"Items: {result['items']}")
    print(f"Confidence: {result['confidence']}")
