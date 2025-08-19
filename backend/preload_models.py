#!/usr/bin/env python3
"""
Pre-load ML models during Docker build to avoid runtime delays.
"""
import os
import sys

def preload_sentence_transformer():
    """Pre-download the sentence transformer model."""
    try:
        print("Pre-downloading sentence transformer model...")
        from sentence_transformers import SentenceTransformer
        
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✓ Sentence transformer model downloaded successfully")
        
        # Verify model works
        test_embedding = model.encode(["test sentence"])
        print(f"✓ Model verification successful (embedding shape: {test_embedding.shape})")
        
        return True
        
    except ImportError as e:
        print(f"✗ sentence-transformers not available: {e}")
        return False
    except Exception as e:
        print(f"✗ Model download failed: {e}")
        return False

def main():
    """Main preloading function."""
    print("Starting model preloading...")
    
    success = preload_sentence_transformer()
    
    if success:
        print("✓ All models preloaded successfully")
        sys.exit(0)
    else:
        print("⚠ Model preloading failed, but continuing (models will be downloaded at runtime)")
        # Don't fail the build - just warn
        sys.exit(0)

if __name__ == "__main__":
    main()
