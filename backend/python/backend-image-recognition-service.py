"""
Image Recognition Service
Detects brands and items from product photos using AI
"""

import base64
from typing import Dict, List, Optional
import re


class ImageRecognitionService:
    """
    Analyze product images to detect:
    1. Brand logos/tags
    2. Product type (jeans, jacket, shoes, etc.)
    3. Authenticity markers
    4. Style/design features
    """
    
    def __init__(self, use_cloud_vision: bool = False):
        self.use_cloud_vision = use_cloud_vision
        
        # Brand logo patterns
        self.brand_keywords = {
            'supreme': ['supreme', 'box logo', 'bogo'],
            'nike': ['nike', 'swoosh', 'jumpman', 'jordan'],
            'adidas': ['adidas', 'three stripes', 'trefoil'],
            'gucci': ['gucci', 'gg', 'double g'],
            'louis vuitton': ['louis vuitton', 'lv', 'monogram'],
            'amiri': ['amiri', 'mx1', 'leather patch'],
            'bape': ['bape', 'a bathing ape', 'camo', 'shark'],
            'off-white': ['off-white', 'off white', 'virgil'],
            'balenciaga': ['balenciaga', 'triple s'],
            'yeezy': ['yeezy', 'boost', 'adidas yzy']
        }
        
        if use_cloud_vision:
            try:
                from google.cloud import vision
                self.vision_client = vision.ImageAnnotatorClient()
            except ImportError:
                print("Google Cloud Vision not available")
                self.use_cloud_vision = False
    
    def detect_brand_and_item(self, image_path: str, 
                             expected_brand: Optional[str] = None) -> Dict:
        """
        Main method to analyze product image
        
        Returns:
            {
                'detected_brand': str,
                'brand_confidence': float,
                'item_type': str,
                'detected_items': list,
                'authenticity_score': float,
                'features': list
            }
        """
        # Extract visual features
        if self.use_cloud_vision:
            labels = self._extract_labels_cloud(image_path)
            text = self._extract_text_cloud(image_path)
            logos = self._detect_logos_cloud(image_path)
        else:
            labels = self._extract_labels_basic(image_path)
            text = self._extract_text_basic(image_path)
            logos = []
        
        # Detect brand
        brand_result = self._detect_brand(labels, text, logos, expected_brand)
        
        # Detect item type
        item_type = self._detect_item_type(labels)
        
        # Calculate authenticity score
        authenticity = self._calculate_authenticity_score(
            brand_result, 
            labels, 
            text, 
            image_path
        )
        
        return {
            'detected_brand': brand_result['brand'],
            'brand_confidence': brand_result['confidence'],
            'item_type': item_type,
            'detected_items': labels,
            'authenticity_score': authenticity,
            'features': self._extract_features(labels, text)
        }
    
    def _extract_labels_cloud(self, image_path: str) -> List[str]:
        """Extract labels using Google Cloud Vision"""
        try:
            with open(image_path, 'rb') as image_file:
                content = image_file.read()
            
            image = self.vision_client.image(content=content)
            response = self.vision_client.label_detection(image=image)
            
            labels = [label.description.lower() for label in response.label_annotations]
            return labels
        except Exception as e:
            print(f"Cloud Vision labels error: {e}")
            return []
    
    def _extract_text_cloud(self, image_path: str) -> str:
        """Extract text from image using Cloud Vision"""
        try:
            with open(image_path, 'rb') as image_file:
                content = image_file.read()
            
            image = self.vision_client.image(content=content)
            response = self.vision_client.text_detection(image=image)
            
            if response.text_annotations:
                return response.text_annotations[0].description.lower()
            return ""
        except Exception as e:
            print(f"Cloud Vision text error: {e}")
            return ""
    
    def _detect_logos_cloud(self, image_path: str) -> List[Dict]:
        """Detect brand logos using Cloud Vision"""
        try:
            with open(image_path, 'rb') as image_file:
                content = image_file.read()
            
            image = self.vision_client.image(content=content)
            response = self.vision_client.logo_detection(image=image)
            
            logos = []
            for logo in response.logo_annotations:
                logos.append({
                    'description': logo.description.lower(),
                    'score': logo.score
                })
            return logos
        except Exception as e:
            print(f"Cloud Vision logo error: {e}")
            return []
    
    def _extract_labels_basic(self, image_path: str) -> List[str]:
        """Basic label extraction (fallback)"""
        # Placeholder - in production, use a local ML model
        # or simpler image analysis
        return ['clothing', 'fashion', 'apparel']
    
    def _extract_text_basic(self, image_path: str) -> str:
        """Basic text extraction (fallback)"""
        # Use OCR service if available
        try:
            from .ocr_service import OCRService
            ocr = OCRService()
            return ocr._extract_text(image_path).lower()
        except:
            return ""
    
    def _detect_brand(self, labels: List[str], text: str, 
                     logos: List[Dict], expected_brand: Optional[str]) -> Dict:
        """
        Detect brand from image analysis
        
        Returns:
            {
                'brand': str,
                'confidence': float,
                'source': str  (logo, text, label, expected)
            }
        """
        confidence = 0.0
        detected_brand = None
        source = None
        
        # Check logos first (highest confidence)
        if logos:
            for logo in logos:
                if logo['score'] > 0.7:
                    detected_brand = logo['description']
                    confidence = logo['score']
                    source = 'logo'
                    break
        
        # Check text mentions
        if not detected_brand:
            for brand, keywords in self.brand_keywords.items():
                for keyword in keywords:
                    if keyword in text:
                        detected_brand = brand
                        confidence = 0.7
                        source = 'text'
                        break
                if detected_brand:
                    break
        
        # Check labels
        if not detected_brand:
            for brand in self.brand_keywords.keys():
                if brand in ' '.join(labels):
                    detected_brand = brand
                    confidence = 0.5
                    source = 'label'
                    break
        
        # If expected brand provided, verify match
        if expected_brand:
            if detected_brand and expected_brand.lower() in detected_brand.lower():
                confidence = min(1.0, confidence + 0.2)  # Boost confidence
            else:
                # Didn't detect the expected brand
                # Still return expected but with lower confidence
                detected_brand = expected_brand
                confidence = 0.3
                source = 'expected'
        
        return {
            'brand': detected_brand or 'unknown',
            'confidence': confidence,
            'source': source or 'none'
        }
    
    def _detect_item_type(self, labels: List[str]) -> str:
        """Detect type of clothing item"""
        clothing_types = {
            'jeans': ['jeans', 'denim', 'pants', 'trousers'],
            'jacket': ['jacket', 'coat', 'outerwear', 'blazer'],
            'shoes': ['shoes', 'sneakers', 'footwear', 'boots'],
            'shirt': ['shirt', 't-shirt', 'tee', 'top', 'blouse'],
            'hoodie': ['hoodie', 'sweatshirt', 'sweater'],
            'accessories': ['bag', 'watch', 'belt', 'hat', 'cap', 'sunglasses']
        }
        
        label_text = ' '.join(labels).lower()
        
        for item_type, keywords in clothing_types.items():
            for keyword in keywords:
                if keyword in label_text:
                    return item_type
        
        return 'clothing'
    
    def _calculate_authenticity_score(self, brand_result: Dict, 
                                     labels: List[str], 
                                     text: str,
                                     image_path: str) -> float:
        """
        Calculate authenticity score based on various factors
        
        Factors:
        - Brand logo detected: +0.3
        - Tags visible: +0.2
        - High quality image: +0.2
        - Correct product features: +0.3
        """
        score = 0.0
        
        # Brand logo detected with high confidence
        if brand_result['confidence'] > 0.7:
            score += 0.3
        elif brand_result['confidence'] > 0.5:
            score += 0.2
        
        # Tags/labels visible in image
        tag_keywords = ['tag', 'label', 'authentication', 'hologram', 'serial']
        if any(keyword in ' '.join(labels) for keyword in tag_keywords):
            score += 0.2
        
        # Check for authenticity keywords in text
        auth_keywords = ['authentic', 'genuine', 'original', 'certified']
        if any(keyword in text for keyword in auth_keywords):
            score += 0.1
        
        # Image quality check (basic heuristic)
        try:
            from PIL import Image
            img = Image.open(image_path)
            width, height = img.size
            
            # High resolution image
            if width >= 1080 and height >= 1080:
                score += 0.2
            elif width >= 720 and height >= 720:
                score += 0.1
            
            # Not blurry (check if sharp)
            # This is a placeholder - in production use blur detection algorithm
            score += 0.2
        except:
            pass
        
        return min(1.0, score)
    
    def _extract_features(self, labels: List[str], text: str) -> List[str]:
        """Extract notable features from the item"""
        features = []
        
        # Style features
        style_keywords = [
            'distressed', 'ripped', 'vintage', 'leather', 'suede',
            'embroidered', 'printed', 'logo', 'patch', 'zip',
            'button', 'pocket', 'hood', 'collar'
        ]
        
        combined_text = ' '.join(labels) + ' ' + text
        
        for keyword in style_keywords:
            if keyword in combined_text:
                features.append(keyword)
        
        return features
    
    def verify_product_match(self, image_path: str, 
                            brand: str, 
                            item_name: str) -> Dict:
        """
        Verify that image matches claimed product
        
        Returns:
            {
                'matches': bool,
                'confidence': float,
                'issues': list
            }
        """
        analysis = self.detect_brand_and_item(image_path, brand)
        
        issues = []
        confidence = analysis['brand_confidence']
        
        # Check brand match
        if analysis['detected_brand'].lower() != brand.lower():
            issues.append(f"Detected brand '{analysis['detected_brand']}' doesn't match claimed '{brand}'")
            confidence *= 0.5
        
        # Check item type (if we can extract it from item_name)
        item_name_lower = item_name.lower()
        if 'jean' in item_name_lower and analysis['item_type'] != 'jeans':
            issues.append(f"Item appears to be {analysis['item_type']}, not jeans")
            confidence *= 0.7
        
        # Check authenticity
        if analysis['authenticity_score'] < 0.5:
            issues.append("Low authenticity score - may need manual review")
            confidence *= 0.8
        
        matches = len(issues) == 0 and confidence > 0.6
        
        return {
            'matches': matches,
            'confidence': confidence,
            'issues': issues,
            'detected': analysis
        }


# Example usage
if __name__ == '__main__':
    recognizer = ImageRecognitionService()
    
    # Test detection
    result = recognizer.detect_brand_and_item(
        'test_image.jpg',
        expected_brand='Amiri'
    )
    
    print("Detection result:")
    print(f"Brand: {result['detected_brand']} ({result['brand_confidence']*100:.0f}% confidence)")
    print(f"Item type: {result['item_type']}")
    print(f"Authenticity: {result['authenticity_score']*100:.0f}%")
    print(f"Features: {', '.join(result['features'])}")
