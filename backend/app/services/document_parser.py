"""
Document Parser Service - Refactored from Challenge 1A Logic

This service contains the surgically refactored logic from:
- connect-the-dots-pdf-challenge-1a/pdf_extractor.py
- connect-the-dots-pdf-challenge-1a/comprehensive_feature_extractor.py

Implements the complete 4-stage processing pipeline from the winning Challenge 1A submission.
"""
import io
import re
import statistics
import logging
from collections import Counter, defaultdict
from typing import List, Dict, Tuple, Optional, Any, Union
import math

# PyMuPDF for PDF processing
try:
    import fitz
    FITZ_AVAILABLE = True
except ImportError:
    FITZ_AVAILABLE = False

# Fallback PDF processing
try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
    from pdfminer.layout import LAParams
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

# Language detection
try:
    from lingua import Language, LanguageDetectorBuilder
    LINGUA_AVAILABLE = True
except ImportError:
    LINGUA_AVAILABLE = False

# CRF support
try:
    from sklearn_crfsuite import CRF
    CRF_AVAILABLE = True
except ImportError:
    CRF_AVAILABLE = False

logger = logging.getLogger(__name__)

# Constants from Challenge 1A
DEFAULT_FONT_SIZE_BINS = [8, 10, 12, 14, 18, 24]
DEFAULT_RELATIVE_SIZE_BINS = [0.9, 1.1, 1.3, 1.6, 2.0]
DEFAULT_SPACE_RATIO_BINS = [0.5, 1.0, 1.5, 2.5, 4.0]
DEFAULT_LENGTH_BINS = [10, 30, 80, 150, 300]
MIN_HEADING_SCORE = 8
MIN_TITLE_SCORE = 8
MAX_TITLE_LENGTH = 200
MIN_SECTION_LENGTH = 2

class DocumentParser:
    """
    Document parsing service implementing the proven 4-stage processing pipeline from Challenge 1A:
    1. Triage (embedded ToC extraction)
    2. Deep Content & Layout Feature Extraction  
    3. ML Classification (CRF-based heading detection)
    4. Hierarchical Reconstruction
    
    Refactored from the winning Challenge 1A submission to work with raw bytes and return text chunks.
    """
    
    def __init__(self):
        """Initialize the document parser with all components from Challenge 1A."""
        self.supported_formats = ['.pdf']
        
        # Initialize language detector if available
        if LINGUA_AVAILABLE:
            self.language_detector = LanguageDetectorBuilder.from_all_languages().build()
        else:
            self.language_detector = None
        
        # Initialize CRF classifier
        self.crf_classifier = self._init_crf_classifier()
        
        logger.info("DocumentParser initialized with Challenge 1A logic")
    
    def _init_crf_classifier(self):
        """Initialize CRF classifier if available."""
        if CRF_AVAILABLE:
            return CRF(
                algorithm='lbfgs',
                c1=0.1,
                c2=0.1,
                max_iterations=100,
                all_possible_transitions=True
            )
        return None
    
    def get_text_chunks(self, file_content: bytes) -> List[Dict]:
        """
        Execute the entire Challenge 1A pipeline in memory and return semantically coherent text chunks.
        
        Args:
            file_content: Raw bytes of the PDF file
            
        Returns:
            List of dictionaries with format: {'page_number': int, 'text_chunk': str}
        """
        try:
            # Stage 1: Extract text with metadata using the Challenge 1A approach
            pages_data = self._extract_text_with_metadata_from_bytes(file_content)
            
            if not pages_data:
                logger.warning("No pages extracted from PDF")
                return []
            
            # Stage 2: Apply the comprehensive feature extraction
            page_features, document_language = self._extract_comprehensive_features(pages_data)
            
            if not page_features or not any(page_features):
                logger.warning("No features extracted from PDF")
                return self._fallback_text_extraction(pages_data)
            
            # Stage 3: Classify headings using CRF-based approach
            page_classifications = self._classify_headings(page_features)
            
            # Stage 4: Build hierarchical structure and extract coherent chunks
            text_chunks = self._build_text_chunks(pages_data, page_features, page_classifications, document_language)
            
            logger.info(f"Successfully extracted {len(text_chunks)} text chunks from PDF")
            return text_chunks
            
        except Exception as e:
            logger.error(f"DocumentParser pipeline failed: {e}")
            # Fallback to simple text extraction
            return self._simple_fallback_extraction(file_content)
    
    def _extract_text_with_metadata_from_bytes(self, file_content: bytes) -> List[Dict[str, Any]]:
        """
        Extract text blocks with comprehensive metadata from PDF bytes.
        Refactored from Challenge 1A PDFTextExtractor.
        """
        if not FITZ_AVAILABLE:
            return self._extract_with_pdfminer_fallback_from_bytes(file_content)
        
        try:
            # Open PDF from bytes
            doc = fitz.open(stream=file_content, filetype="pdf")
            pages_data = []
            
            logger.info(f"Processing PDF from bytes ({len(doc)} pages)")
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_data = self._extract_page_data(page, page_num)
                pages_data.append(page_data)
            
            doc.close()
            logger.info(f"Extracted text from {len(pages_data)} pages")
            return pages_data
            
        except Exception as e:
            logger.warning(f"PyMuPDF extraction failed: {e}")
            return self._extract_with_pdfminer_fallback_from_bytes(file_content)
    
    def _extract_page_data(self, page, page_num: int) -> Dict[str, Any]:
        """Extract text blocks and metadata from a single page (from Challenge 1A)."""
        # Get page dimensions
        page_rect = page.rect
        page_width = page_rect.width
        page_height = page_rect.height
        
        # Extract text blocks with detailed information
        blocks = page.get_text("dict")
        text_blocks = []
        
        for block in blocks["blocks"]:
            if "lines" in block:  # Text block
                for line in block["lines"]:
                    for span in line["spans"]:
                        # Extract text and metadata
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                            
                        # Font information
                        font_name = span.get("font", "")
                        font_size = span.get("size", 12)
                        font_flags = span.get("flags", 0)
                        
                        # Determine font weight and style
                        is_bold = self._is_bold_font(font_name, font_flags)
                        is_italic = self._is_italic_font(font_name, font_flags)
                        
                        # Bounding box
                        bbox = span.get("bbox", [0, 0, 0, 0])
                        
                        text_block = {
                            "text": text,
                            "bbox": bbox,
                            "font": font_name,
                            "font_size": font_size,
                            "font_flags": font_flags,
                            "is_bold": is_bold,
                            "is_italic": is_italic,
                            "page_num": page_num,
                            "page_width": page_width,
                            "page_height": page_height
                        }
                        
                        text_blocks.append(text_block)
        
        # Enhanced layout analysis
        text_blocks = self._apply_enhanced_layout_analysis(text_blocks, page_width, page_height)
        
        return {
            "page_num": page_num,
            "page_width": page_width,
            "page_height": page_height,
            "text_blocks": text_blocks,
            "rect": [page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1]
        }
    
    def _is_bold_font(self, font_name: str, font_flags: int) -> bool:
        """Determine if font is bold (from Challenge 1A)."""
        font_name_lower = font_name.lower()
        bold_keywords = ["bold", "black", "heavy", "semibold", "thick"]
        name_indicates_bold = any(keyword in font_name_lower for keyword in bold_keywords)
        flags_indicate_bold = bool(font_flags & (1 << 4))
        return name_indicates_bold or flags_indicate_bold
    
    def _is_italic_font(self, font_name: str, font_flags: int) -> bool:
        """Determine if font is italic (from Challenge 1A)."""
        font_name_lower = font_name.lower()
        italic_keywords = ["italic", "oblique", "slanted"]
        name_indicates_italic = any(keyword in font_name_lower for keyword in italic_keywords)
        flags_indicate_italic = bool(font_flags & (1 << 1))
        return name_indicates_italic or flags_indicate_italic
    
    def _apply_enhanced_layout_analysis(self, text_blocks: List[Dict], page_width: float, page_height: float) -> List[Dict]:
        """Apply enhanced layout analysis from Challenge 1A."""
        if not text_blocks:
            return text_blocks
        
        # Detect multi-column layout
        is_multi_column = self._detect_multi_column_layout(text_blocks, page_width)
        
        if is_multi_column:
            text_blocks = self._sort_multi_column_blocks(text_blocks, page_width)
        else:
            text_blocks.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))
        
        return text_blocks
    
    def _detect_multi_column_layout(self, text_blocks: List[Dict], page_width: float) -> bool:
        """Detect multi-column layout (from Challenge 1A)."""
        if len(text_blocks) < 10:
            return False
        
        x_positions = [block["bbox"][0] for block in text_blocks]
        page_center = page_width / 2
        
        left_blocks = sum(1 for x in x_positions if x < page_center - 50)
        right_blocks = sum(1 for x in x_positions if x > page_center + 50)
        
        total_blocks = len(text_blocks)
        left_ratio = left_blocks / total_blocks
        right_ratio = right_blocks / total_blocks
        
        return left_ratio > 0.2 and right_ratio > 0.2
    
    def _sort_multi_column_blocks(self, text_blocks: List[Dict], page_width: float) -> List[Dict]:
        """Sort text blocks for multi-column layout (from Challenge 1A)."""
        page_center = page_width / 2
        margin = 50
        
        left_column = []
        right_column = []
        center_spanning = []
        
        for block in text_blocks:
            x0, y0, x1, y1 = block["bbox"]
            block_center = (x0 + x1) / 2
            block_width = x1 - x0
            
            if block_width > page_width * 0.7:
                center_spanning.append(block)
            elif block_center < page_center - margin:
                left_column.append(block)
            elif block_center > page_center + margin:
                right_column.append(block)
            else:
                if x0 < page_center:
                    left_column.append(block)
                else:
                    right_column.append(block)
        
        # Sort each column by vertical position
        left_column.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))
        right_column.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))
        center_spanning.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))
        
        # Merge columns
        sorted_blocks = []
        
        for block in center_spanning:
            y_pos = block["bbox"][1]
            
            while left_column and left_column[0]["bbox"][1] < y_pos - 10:
                sorted_blocks.append(left_column.pop(0))
            while right_column and right_column[0]["bbox"][1] < y_pos - 10:
                sorted_blocks.append(right_column.pop(0))
            
            sorted_blocks.append(block)
        
        sorted_blocks.extend(left_column)
        sorted_blocks.extend(right_column)
        
        return sorted_blocks
    
    def _extract_comprehensive_features(self, pages_data: List[Dict]) -> Tuple[List[List[Dict]], str]:
        """Extract comprehensive features from Challenge 1A ComprehensiveFeatureExtractor."""
        if not pages_data:
            return [], "english"
        
        # Filter headers/footers
        pages_data = self._filter_headers_footers(pages_data)
        
        # Apply column detection
        pages_data = self._apply_column_detection(pages_data)
        
        # Detect document language
        document_language = self._detect_document_language(pages_data)
        
        # Extract features from each page
        all_page_features = []
        
        for page_idx, page_dict in enumerate(pages_data):
            page_features = self._extract_page_features(page_dict, page_idx, document_language)
            all_page_features.append(page_features)
        
        return all_page_features, document_language
    
    def _filter_headers_footers(self, pages_data: List[Dict]) -> List[Dict]:
        """Filter headers and footers (from Challenge 1A)."""
        if len(pages_data) < 2:
            return pages_data
        
        # Collect potential headers and footers
        all_text_blocks = []
        for page_dict in pages_data:
            text_blocks = page_dict.get("text_blocks", [])
            for block in text_blocks:
                bbox = block.get("bbox", [0, 0, 0, 0])
                page_height = block.get("page_height", 792)
                
                y_top_ratio = bbox[1] / page_height if page_height > 0 else 0
                y_bottom_ratio = bbox[3] / page_height if page_height > 0 else 0
                
                is_potential_header = y_top_ratio < 0.15
                is_potential_footer = y_bottom_ratio > 0.85
                
                if is_potential_header or is_potential_footer:
                    all_text_blocks.append({
                        "text": block.get("text", "").strip(),
                        "page_num": block.get("page_num", 0),
                        "is_header": is_potential_header,
                        "is_footer": is_potential_footer,
                        "original_block": block
                    })
        
        # Find recurring patterns
        text_frequency = Counter()
        for block_info in all_text_blocks:
            text = block_info["text"].lower().strip()
            if len(text) > 3:
                text_frequency[text] += 1
        
        total_pages = len(pages_data)
        threshold = max(2, int(total_pages * 0.4))
        
        recurring_texts = set()
        for text, count in text_frequency.items():
            if count >= threshold:
                recurring_texts.add(text)
        
        # Filter out recurring headers/footers
        filtered_pages = []
        for page_dict in pages_data:
            filtered_blocks = []
            original_blocks = page_dict.get("text_blocks", [])
            
            for block in original_blocks:
                text = block.get("text", "").strip().lower()
                if text not in recurring_texts:
                    filtered_blocks.append(block)
            
            filtered_page = page_dict.copy()
            filtered_page["text_blocks"] = filtered_blocks
            filtered_pages.append(filtered_page)
        
        return filtered_pages
    
    def _apply_column_detection(self, pages_data: List[Dict]) -> List[Dict]:
        """Apply column detection (from Challenge 1A)."""
        processed_pages = []
        
        for page_dict in pages_data:
            text_blocks = page_dict.get("text_blocks", [])
            if not text_blocks:
                processed_pages.append(page_dict)
                continue
            
            page_width = page_dict.get("page_width", 595)
            
            if self._is_multi_column_page(text_blocks, page_width):
                sorted_blocks = self._sort_multi_column_blocks_for_features(text_blocks, page_width)
            else:
                sorted_blocks = sorted(text_blocks, key=lambda b: (-b.get("bbox", [0, 0, 0, 0])[1], b.get("bbox", [0, 0, 0, 0])[0]))
            
            processed_page = page_dict.copy()
            processed_page["text_blocks"] = sorted_blocks
            processed_pages.append(processed_page)
        
        return processed_pages
    
    def _is_multi_column_page(self, text_blocks: List[Dict], page_width: float) -> bool:
        """Check if page has multi-column layout."""
        if len(text_blocks) < 10:
            return False
        
        center_x = page_width / 2
        left_blocks = 0
        right_blocks = 0
        
        for block in text_blocks:
            bbox = block.get("bbox", [0, 0, 0, 0])
            block_center_x = (bbox[0] + bbox[2]) / 2
            
            if block_center_x < center_x * 0.8:
                left_blocks += 1
            elif block_center_x > center_x * 1.2:
                right_blocks += 1
        
        total_blocks = len(text_blocks)
        return (left_blocks > total_blocks * 0.2 and right_blocks > total_blocks * 0.2)
    
    def _sort_multi_column_blocks_for_features(self, text_blocks: List[Dict], page_width: float) -> List[Dict]:
        """Sort blocks for multi-column reading order."""
        center_x = page_width / 2
        left_column = []
        right_column = []
        middle_blocks = []
        
        for block in text_blocks:
            bbox = block.get("bbox", [0, 0, 0, 0])
            block_center_x = (bbox[0] + bbox[2]) / 2
            
            if block_center_x < center_x * 0.8:
                left_column.append(block)
            elif block_center_x > center_x * 1.2:
                right_column.append(block)
            else:
                middle_blocks.append(block)
        
        # Sort each column by vertical position
        left_column.sort(key=lambda b: -b.get("bbox", [0, 0, 0, 0])[1])
        right_column.sort(key=lambda b: -b.get("bbox", [0, 0, 0, 0])[1])
        middle_blocks.sort(key=lambda b: -b.get("bbox", [0, 0, 0, 0])[1])
        
        return middle_blocks + left_column + right_column
    
    def _detect_document_language(self, pages_data: List[Dict]) -> str:
        """Detect document language (from Challenge 1A)."""
        if not self.language_detector:
            return "english"
        
        text_samples = []
        
        for page_idx, page_dict in enumerate(pages_data[:3]):
            text_blocks = page_dict.get("text_blocks", [])
            for block in text_blocks[:10]:
                text = block.get("text", "").strip()
                if len(text) > 20:
                    text_samples.append(text)
        
        if not text_samples:
            return "english"
        
        combined_text = " ".join(text_samples[:5])
        
        try:
            detected_language = self.language_detector.detect_language_of(combined_text)
            if detected_language:
                return detected_language.name.lower()
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
        
        return "english"
    
    def _extract_page_features(self, page_dict: Dict, page_idx: int, language: str) -> List[Dict]:
        """Extract features from a single page (from Challenge 1A)."""
        text_lines = self._extract_text_lines(page_dict)
        
        if not text_lines:
            return []
        
        page_stats = self._calculate_page_statistics(text_lines, page_dict)
        
        line_features = []
        
        for line_idx, line in enumerate(text_lines):
            features = self._extract_line_features(
                line, line_idx, text_lines, page_dict, page_stats, language
            )
            line_features.append(features)
        
        return line_features
    
    def _extract_text_lines(self, page_dict: Dict) -> List[Dict]:
        """Extract and merge text spans into lines."""
        text_blocks = page_dict.get("text_blocks", [])
        lines = []
        
        span_groups = defaultdict(list)
        
        for block in text_blocks:
            text = block.get("text", "").strip()
            if not text:
                continue
            
            bbox = block.get("bbox", [0, 0, 0, 0])
            y_pos = round(bbox[1], 1)
            
            span_groups[y_pos].append(block)
        
        for y_pos in sorted(span_groups.keys()):
            spans = sorted(span_groups[y_pos], key=lambda x: x.get("bbox", [0])[0])
            merged_line = self._merge_line_spans(spans)
            if merged_line:
                lines.append(merged_line)
        
        return lines
    
    def _merge_line_spans(self, spans: List[Dict]) -> Dict:
        """Merge multiple spans into a single line."""
        if not spans:
            return {}
        
        texts = [span.get("text", "").strip() for span in spans]
        combined_text = " ".join(text for text in texts if text)
        
        if not combined_text:
            return {}
        
        # Calculate combined bounding box
        x0 = min(span.get("bbox", [0, 0, 0, 0])[0] for span in spans)
        y0 = min(span.get("bbox", [0, 0, 0, 0])[1] for span in spans)
        x1 = max(span.get("bbox", [0, 0, 0, 0])[2] for span in spans)
        y1 = max(span.get("bbox", [0, 0, 0, 0])[3] for span in spans)
        
        largest_span = max(spans, key=lambda x: x.get("font_size", 0))
        
        return {
            "text": combined_text,
            "bbox": [x0, y0, x1, y1],
            "font": largest_span.get("font", ""),
            "font_size": largest_span.get("font_size", 12),
            "font_flags": largest_span.get("font_flags", 0),
            "is_bold": largest_span.get("is_bold", False),
            "is_italic": largest_span.get("is_italic", False),
            "page_num": largest_span.get("page_num", 0),
            "page_width": largest_span.get("page_width", 612),
            "page_height": largest_span.get("page_height", 792)
        }
    
    def _calculate_page_statistics(self, lines: List[Dict], page_dict: Dict) -> Dict:
        """Calculate page-level statistics for normalization."""
        if not lines:
            return {
                "modal_font_size": 12,
                "avg_line_height": 12,
                "page_width": 600,
                "page_height": 800,
                "dominant_left_margin": 0,
                "avg_line_width": 400,
                "font_sizes": [12],
                "font_size_ranks": {12: 1}
            }
        
        font_sizes = [line.get("font_size", 12) for line in lines]
        
        font_size_counter = Counter(font_sizes)
        modal_font_size = font_size_counter.most_common(1)[0][0]
        
        unique_font_sizes = sorted(set(font_sizes), reverse=True)
        font_size_ranks = {size: rank + 1 for rank, size in enumerate(unique_font_sizes)}
        
        page_rect = page_dict.get("rect", [0, 0, 600, 800])
        page_width = page_rect[2] - page_rect[0]
        page_height = page_rect[3] - page_rect[1]
        
        left_margins = [line.get("bbox", [0, 0, 0, 0])[0] for line in lines]
        margin_counter = Counter(left_margins)
        dominant_left_margin = margin_counter.most_common(1)[0][0] if margin_counter else 0
        
        line_heights = []
        for line in lines:
            bbox = line.get("bbox", [0, 0, 0, 0])
            height = bbox[3] - bbox[1]
            if height > 0:
                line_heights.append(height)
        
        avg_line_height = statistics.mean(line_heights) if line_heights else 12
        
        line_widths = []
        for line in lines:
            bbox = line.get("bbox", [0, 0, 0, 0])
            width = bbox[2] - bbox[0]
            if width > 0:
                line_widths.append(width)
        
        avg_line_width = statistics.mean(line_widths) if line_widths else 400
        
        return {
            "modal_font_size": modal_font_size,
            "avg_line_height": avg_line_height,
            "page_width": page_width,
            "page_height": page_height,
            "dominant_left_margin": dominant_left_margin,
            "avg_line_width": avg_line_width,
            "font_sizes": font_sizes,
            "font_size_ranks": font_size_ranks
        }
    
    def _extract_line_features(self, line: Dict, line_idx: int, all_lines: List[Dict], 
                              page_dict: Dict, page_stats: Dict, language: str) -> Dict:
        """Extract comprehensive features for a single text line (from Challenge 1A)."""
        text = line.get("text", "").strip()
        bbox = line.get("bbox", [0, 0, 0, 0])
        font_size = line.get("font_size", 12)
        page_num = line.get("page_num", 0)
        
        features = {
            "text": text,
            "bbox": bbox,
            "page_num": page_num,
            "line_idx": line_idx
        }
        
        # Typographical features
        features["font_size"] = font_size
        features["relative_font_size"] = font_size / page_stats["modal_font_size"]
        features["font_size_rank"] = page_stats["font_size_ranks"].get(font_size, 10)
        features["is_bold"] = line.get("is_bold", False)
        features["is_italic"] = line.get("is_italic", False)
        
        font_name = line.get("font", "").lower()
        features["font_name_has_bold"] = any(word in font_name for word in ["bold", "black", "heavy", "semibold"])
        
        # Layout features
        features["indentation"] = bbox[0] - page_stats["dominant_left_margin"]
        
        line_width = bbox[2] - bbox[0]
        line_center = (bbox[0] + bbox[2]) / 2
        page_center = page_stats["page_width"] / 2
        center_tolerance = page_stats["page_width"] * 0.02
        
        features["is_centered"] = (abs(line_center - page_center) < center_tolerance and 
                                 line_width < page_stats.get("avg_line_width", 400) * 0.8)
        
        avg_line_width = page_stats.get("avg_line_width", 400)
        features["line_width_ratio"] = line_width / avg_line_width
        
        if line_idx > 0:
            prev_line = all_lines[line_idx - 1]
            prev_bbox = prev_line.get("bbox", [0, 0, 0, 0])
            space_before = bbox[1] - prev_bbox[3]
            prev_line_height = prev_bbox[3] - prev_bbox[1]
            features["space_before_ratio"] = space_before / max(prev_line_height, 1)
        else:
            features["space_before_ratio"] = 0
        
        features["vertical_position_ratio"] = bbox[1] / max(page_stats["page_height"], 1)
        
        # Content features
        if language not in ["japanese", "chinese", "korean"]:
            features["is_uppercase"] = text.isupper() if text else False
            features["is_titlecase"] = text.istitle() if text else False
        else:
            features["is_uppercase"] = False
            features["is_titlecase"] = False
        
        features["char_count"] = len(text)
        features["word_count"] = len(text.split()) if text else 0
        features["ends_with_punct"] = text.rstrip().endswith(('.', '?', '!')) if text else False
        features["has_colon_suffix"] = text.rstrip().endswith(':') if text else False
        features["has_numeric_prefix"] = bool(re.match(r'^\s*\d+(\.\d+)*[\.\)\s]', text)) if text else False
        features["is_chapter_heading"] = bool(re.match(r'^\s*(chapter|section|part)\s+\d+', text, re.IGNORECASE)) if text else False
        features["is_appendix"] = bool(re.match(r'^\s*appendix', text, re.IGNORECASE)) if text else False
        features["starts_with_bullet"] = bool(re.match(r'^\s*[•\-\*]', text)) if text else False
        
        features["language"] = language
        
        return features
    
    def _classify_headings(self, page_features: List[List[Dict]]) -> List[List[str]]:
        """Classify headings using CRF or rule-based approach (from Challenge 1A)."""
        if not page_features or not any(page_features):
            return []
        
        # Try CRF classification if available
        if self.crf_classifier and CRF_AVAILABLE:
            try:
                # Create bootstrap training data
                X_train, y_train = self._create_bootstrap_training_data(page_features)
                
                if X_train and y_train:
                    # Train CRF model
                    self.crf_classifier.fit(X_train, y_train)
                    
                    # Convert features to CRF format for prediction
                    X_test = []
                    for page_feature_list in page_features:
                        page_crf_features = []
                        for i in range(len(page_feature_list)):
                            line_crf_features = self._features_for_crf(page_feature_list, i)
                            page_crf_features.append(line_crf_features)
                        X_test.append(page_crf_features)
                    
                    # Predict labels
                    predictions = self.crf_classifier.predict(X_test)
                    
                    # Convert IOB format back to simple labels
                    converted_predictions = []
                    for page_preds in predictions:
                        page_converted = []
                        for pred in page_preds:
                            if pred.startswith('B-') or pred.startswith('I-'):
                                page_converted.append(pred[2:])
                            else:
                                page_converted.append('P')
                        converted_predictions.append(page_converted)
                    
                    return converted_predictions
            except Exception as e:
                logger.warning(f"CRF classification failed: {e}")
        
        # Fallback to rule-based classification
        return self._rule_based_classification(page_features)
    
    def _create_bootstrap_training_data(self, page_features: List[List[Dict]]) -> Tuple[List[List[Dict]], List[List[str]]]:
        """Create training data using rule-based classifier."""
        X_train = []
        y_train = []
        
        for page_feature_list in page_features:
            if not page_feature_list:
                continue
                
            page_labels = []
            for features in page_feature_list:
                label = self._classify_line_rule_based(features)
                if label.startswith('H'):
                    page_labels.append(f'B-{label}')
                else:
                    page_labels.append('O')
            
            page_crf_features = []
            for i in range(len(page_feature_list)):
                line_crf_features = self._features_for_crf(page_feature_list, i)
                page_crf_features.append(line_crf_features)
            
            X_train.append(page_crf_features)
            y_train.append(page_labels)
        
        return X_train, y_train
    
    def _features_for_crf(self, page_features: List[Dict], line_idx: int) -> Dict:
        """Convert features to CRF format (from Challenge 1A)."""
        if line_idx >= len(page_features):
            return {}
        
        features = page_features[line_idx]
        crf_features = {}
        
        # Current line features
        crf_features.update({
            'font_size_bin': self._discretize_font_size(features.get('font_size', 12)),
            'relative_font_size_bin': self._discretize_relative_size(features.get('relative_font_size', 1.0)),
            'font_size_rank': min(features.get('font_size_rank', 10), 5),
            'is_bold': features.get('is_bold', False),
            'is_italic': features.get('is_italic', False),
            'is_centered': features.get('is_centered', False),
            'char_count_bin': self._discretize_length(features.get('char_count', 0)),
            'has_numeric_prefix': features.get('has_numeric_prefix', False),
            'is_chapter_heading': features.get('is_chapter_heading', False),
            'space_before_bin': self._discretize_space_ratio(features.get('space_before_ratio', 0))
        })
        
        # Context features
        if line_idx > 0:
            prev_features = page_features[line_idx - 1]
            crf_features.update({
                '-1:font_size_bin': self._discretize_font_size(prev_features.get('font_size', 12)),
                '-1:is_bold': prev_features.get('is_bold', False),
                '-1:ends_with_punct': prev_features.get('ends_with_punct', False)
            })
        else:
            crf_features['BOS'] = True
        
        if line_idx < len(page_features) - 1:
            next_features = page_features[line_idx + 1]
            crf_features.update({
                '+1:font_size_bin': self._discretize_font_size(next_features.get('font_size', 12)),
                '+1:is_bold': next_features.get('is_bold', False)
            })
        else:
            crf_features['EOS'] = True
        
        return crf_features
    
    def _discretize_font_size(self, font_size: float) -> str:
        """Discretize font size into bins."""
        if font_size <= 8:
            return 'very_small'
        elif font_size <= 10:
            return 'small'
        elif font_size <= 12:
            return 'normal'
        elif font_size <= 14:
            return 'medium'
        elif font_size <= 18:
            return 'large'
        else:
            return 'very_large'
    
    def _discretize_relative_size(self, relative_size: float) -> str:
        """Discretize relative font size."""
        if relative_size < 0.9:
            return 'smaller'
        elif relative_size < 1.1:
            return 'normal'
        elif relative_size < 1.3:
            return 'larger'
        elif relative_size < 1.6:
            return 'much_larger'
        else:
            return 'very_large'
    
    def _discretize_space_ratio(self, space_ratio: float) -> str:
        """Discretize spacing ratio."""
        if space_ratio < 0.5:
            return 'tight'
        elif space_ratio < 1.0:
            return 'normal'
        elif space_ratio < 2.0:
            return 'loose'
        else:
            return 'very_loose'
    
    def _discretize_length(self, char_count: int) -> str:
        """Discretize character count."""
        if char_count <= 10:
            return 'very_short'
        elif char_count <= 30:
            return 'short'
        elif char_count <= 80:
            return 'medium'
        elif char_count <= 150:
            return 'long'
        else:
            return 'very_long'
    
    def _rule_based_classification(self, page_features: List[List[Dict]]) -> List[List[str]]:
        """Fallback rule-based classification."""
        predictions = []
        for page_feature_list in page_features:
            page_predictions = []
            for features in page_feature_list:
                label = self._classify_line_rule_based(features)
                page_predictions.append(label)
            predictions.append(page_predictions)
        
        return predictions
    
    def _classify_line_rule_based(self, features: Dict) -> str:
        """Classify a line using rule-based heuristics (from Challenge 1A)."""
        text = features.get('text', '').strip()
        if not text or len(text) > MAX_TITLE_LENGTH:
            return 'P'
        
        if len(text) <= 3:
            return 'P'
        
        if re.match(r'^\s*\d+[\.)\s]*$', text):
            return 'P'
        
        heading_score = 0
        
        # Font size signals
        relative_size = features.get('relative_font_size', 1.0)
        font_rank = features.get('font_size_rank', 10)
        
        if relative_size >= 1.5:
            heading_score += 4
        elif relative_size >= 1.3:
            heading_score += 3
        elif relative_size >= 1.1:
            heading_score += 1
        
        if font_rank <= 2:
            heading_score += 3
        elif font_rank <= 3:
            heading_score += 2
        
        # Styling signals
        if features.get('is_bold', False):
            heading_score += 3
        if features.get('is_centered', False):
            heading_score += 2
        
        # Layout signals
        space_before = features.get('space_before_ratio', 0)
        if space_before >= 2.0:
            heading_score += 3
        elif space_before >= 1.5:
            heading_score += 2
        
        # Content signals
        if features.get('has_numeric_prefix', False):
            if not self._is_likely_form_field(text):
                heading_score += 4
            else:
                heading_score -= 2
                
        if features.get('is_chapter_heading', False):
            heading_score += 4
        if features.get('is_appendix', False):
            heading_score += 3
        if not features.get('ends_with_punct', False):
            heading_score += 1
        
        # Length signals
        char_count = features.get('char_count', 0)
        if 5 <= char_count <= 80:
            heading_score += 1
        elif char_count > 150:
            heading_score -= 2
        
        # Classify based on score
        if heading_score >= MIN_HEADING_SCORE:
            return self._determine_heading_level(features)
        elif heading_score >= 6:
            return self._determine_heading_level(features, default='H3')
        else:
            return 'P'
    
    def _is_likely_form_field(self, text: str) -> bool:
        """Check if text is likely a form field."""
        form_patterns = [
            r'^\d+\.\s+[A-Z][^.]*:?\s*$',
            r'^\d+\.\s+[A-Z][a-z\s]{2,15}:?\s*$',
        ]
        
        for pattern in form_patterns:
            if re.match(pattern, text):
                return True
        
        form_keywords = ['name', 'address', 'phone', 'email', 'date', 'signature']
        text_lower = text.lower()
        
        if any(keyword in text_lower for keyword in form_keywords) and len(text) < 50:
            return True
        
        return False
    
    def _determine_heading_level(self, features: Dict, default: str = 'H2') -> str:
        """Determine specific heading level."""
        text = features.get('text', '')
        numeric_match = re.match(r'^\s*(\d+(?:\.\d+)*)', text)
        
        if numeric_match:
            number_parts = numeric_match.group(1).split('.')
            if len(number_parts) == 1:
                return 'H1'
            elif len(number_parts) == 2:
                return 'H2'
            else:
                return 'H3'
        
        relative_size = features.get('relative_font_size', 1.0)
        font_rank = features.get('font_size_rank', 10)
        is_centered = features.get('is_centered', False)
        
        if relative_size >= 1.8 or font_rank == 1 or is_centered:
            return 'H1'
        elif relative_size >= 1.4 or font_rank <= 2:
            return 'H2'
        else:
            return 'H3'
    
    def _build_text_chunks(self, pages_data: List[Dict], page_features: List[List[Dict]], 
                          page_classifications: List[List[str]], document_language: str) -> List[Dict]:
        """Build coherent text chunks from classified content."""
        chunks = []
        current_chunk = ""
        current_page = 0
        
        for page_idx, (page_dict, page_feature_list, page_class_list) in enumerate(
            zip(pages_data, page_features, page_classifications)
        ):
            page_text_blocks = []
            
            # Collect all text from the page in order
            for line_features, line_class in zip(page_feature_list, page_class_list):
                text = line_features.get('text', '').strip()
                if text:
                    page_text_blocks.append({
                        'text': text,
                        'is_heading': line_class in ['H1', 'H2', 'H3'],
                        'heading_level': line_class if line_class in ['H1', 'H2', 'H3'] else None
                    })
            
            # Build chunks based on headings as natural boundaries
            for block in page_text_blocks:
                text = block['text']
                is_heading = block['is_heading']
                
                # If we encounter a heading and have accumulated text, finalize the current chunk
                if is_heading and current_chunk.strip():
                    # Add the accumulated chunk
                    if len(current_chunk.strip()) > 50:  # Only add substantial chunks
                        chunks.append({
                            'page_number': current_page,
                            'text_chunk': current_chunk.strip()
                        })
                    current_chunk = ""
                    current_page = page_idx
                
                # Add current text to the chunk
                if current_chunk:
                    current_chunk += " " + text
                else:
                    current_chunk = text
                    current_page = page_idx
                
                # If chunk gets too long, split it
                if len(current_chunk) > 2000:
                    # Try to find a good breaking point
                    sentences = current_chunk.split('. ')
                    if len(sentences) > 1:
                        # Keep first part as a chunk
                        first_part = '. '.join(sentences[:len(sentences)//2]) + '.'
                        remaining_part = '. '.join(sentences[len(sentences)//2:])
                        
                        chunks.append({
                            'page_number': current_page,
                            'text_chunk': first_part
                        })
                        current_chunk = remaining_part
                    else:
                        # Force split if no sentence boundaries
                        chunks.append({
                            'page_number': current_page,
                            'text_chunk': current_chunk[:1500] + "..."
                        })
                        current_chunk = current_chunk[1500:]
        
        # Add the final chunk
        if current_chunk.strip() and len(current_chunk.strip()) > 50:
            chunks.append({
                'page_number': current_page,
                'text_chunk': current_chunk.strip()
            })
        
        # If no good chunks were created, fall back to page-based chunking
        if not chunks:
            return self._fallback_text_extraction(pages_data)
        
        logger.info(f"Built {len(chunks)} coherent text chunks")
        return chunks
    
    def _fallback_text_extraction(self, pages_data: List[Dict]) -> List[Dict]:
        """Fallback to simple page-based text extraction."""
        chunks = []
        
        for page_dict in pages_data:
            page_num = page_dict.get("page_num", 0)
            text_blocks = page_dict.get("text_blocks", [])
            
            page_text = " ".join(block.get("text", "") for block in text_blocks if block.get("text", "").strip())
            
            if page_text.strip():
                # Split long pages into smaller chunks
                if len(page_text) > 2000:
                    sentences = page_text.split('. ')
                    current_chunk = ""
                    
                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) > 1500:
                            if current_chunk.strip():
                                chunks.append({
                                    'page_number': page_num,
                                    'text_chunk': current_chunk.strip() + '.'
                                })
                            current_chunk = sentence
                        else:
                            current_chunk += ". " + sentence if current_chunk else sentence
                    
                    if current_chunk.strip():
                        chunks.append({
                            'page_number': page_num,
                            'text_chunk': current_chunk.strip()
                        })
                else:
                    chunks.append({
                        'page_number': page_num,
                        'text_chunk': page_text.strip()
                    })
        
        return chunks
    
    def _extract_with_pdfminer_fallback_from_bytes(self, file_content: bytes) -> List[Dict[str, Any]]:
        """Fallback extraction using pdfminer from bytes."""
        if not PDFMINER_AVAILABLE:
            logger.error("pdfminer.six not available for fallback extraction")
            return []
        
        try:
            logger.info("Using pdfminer fallback for bytes")
            
            # Create file-like object from bytes
            file_obj = io.BytesIO(file_content)
            
            laparams = LAParams(
                line_margin=0.5,
                word_margin=0.1,
                char_margin=2.0,
                boxes_flow=0.5,
                all_texts=False
            )
            
            text = pdfminer_extract_text(file_obj, laparams=laparams)
            
            if not text:
                return []
            
            # Create simplified page structure
            lines = text.split('\n')
            text_blocks = []
            
            page_width = 595
            page_height = 842
            y_position = page_height - 50
            
            for line in lines:
                line = line.strip()
                if not line:
                    y_position -= 15
                    continue
                
                text_block = {
                    "text": line,
                    "bbox": [50, y_position, page_width - 50, y_position + 12],
                    "font": "Unknown",
                    "font_size": 12.0,
                    "font_flags": 0,
                    "is_bold": False,
                    "is_italic": False,
                    "page_num": 0,
                    "page_width": page_width,
                    "page_height": page_height
                }
                
                text_blocks.append(text_block)
                y_position -= 20
            
            return [{
                "page_num": 0,
                "page_width": page_width,
                "page_height": page_height,
                "text_blocks": text_blocks
            }]
            
        except Exception as e:
            logger.error(f"pdfminer fallback extraction failed: {e}")
            return []
    
    def _simple_fallback_extraction(self, file_content: bytes) -> List[Dict]:
        """Simple fallback when all processing fails."""
        try:
            # Try basic text extraction
            fallback_data = self._extract_with_pdfminer_fallback_from_bytes(file_content)
            
            if fallback_data:
                chunks = []
                for page_dict in fallback_data:
                    page_num = page_dict.get("page_num", 0)
                    text_blocks = page_dict.get("text_blocks", [])
                    
                    page_text = " ".join(block.get("text", "") for block in text_blocks if block.get("text", "").strip())
                    
                    if page_text.strip():
                        chunks.append({
                            'page_number': page_num,
                            'text_chunk': page_text.strip()
                        })
                
                return chunks
            
        except Exception as e:
            logger.error(f"Simple fallback extraction failed: {e}")
        
        # Ultimate fallback - return empty list
        return []
