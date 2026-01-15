"""
AI Agents for Keyword Intent Analysis
=====================================
Two specialized agents for SEO keyword classification:
- intent_agent: Fast intent classification
- logic_agent: Zero-shot deep reasoning for custom labels
"""

from transformers import pipeline

# ========================================
# AGENT DEFINITIONS
# ========================================

# Intent Agent - Fast Intent Analysis
# Model: Falconsai/intent_classification
print("🧠 Loading intent_agent (Fast Intent Analysis)...")
intent_agent = pipeline(
    "text-classification", 
    model="Falconsai/intent_classification"
)
print("✅ intent_agent ready!")

# Logic Agent - Deep Reasoning / Zero-Shot Classification
# Model: facebook/bart-large-mnli
print("🧠 Loading logic_agent (Deep Reasoning)...")
logic_agent = pipeline(
    "zero-shot-classification", 
    model="facebook/bart-large-mnli"
)
print("✅ logic_agent ready!")

print("\n🎉 Both AI agents are loaded and ready!")

# ========================================
# HELPER FUNCTIONS
# ========================================

def analyze_intent(keyword: str) -> dict:
    """
    Fast intent analysis using intent_agent
    Returns: {label, score}
    """
    result = intent_agent(keyword)[0]
    return {
        "keyword": keyword,
        "intent": result["label"],
        "confidence": round(result["score"], 3)
    }


def classify_with_labels(keyword: str, labels: list) -> dict:
    """
    Zero-shot classification using logic_agent
    Allows custom labels for SEO use cases
    
    Example labels: ["Commercial", "Informational", "Navigational", "Transactional"]
    """
    result = logic_agent(keyword, labels)
    return {
        "keyword": keyword,
        "best_label": result["labels"][0],
        "confidence": round(result["scores"][0], 3),
        "all_scores": dict(zip(result["labels"], [round(s, 3) for s in result["scores"]]))
    }


# ========================================
# QUICK TEST
# ========================================
if __name__ == "__main__":
    print("\n" + "="*50)
    print("TESTING AI AGENTS")
    print("="*50)
    
    # Test keywords
    test_keywords = [
        "buy twisting machine online",
        "what is yarn twisting",
        "meera industries contact"
    ]
    
    # SEO intent labels
    seo_labels = ["Commercial", "Informational", "Navigational", "Transactional"]
    
    for kw in test_keywords:
        print(f"\n📌 Keyword: '{kw}'")
        
        # Fast intent
        intent_result = analyze_intent(kw)
        print(f"   intent_agent → {intent_result['intent']} ({intent_result['confidence']})")
        
        # Deep reasoning with custom labels
        logic_result = classify_with_labels(kw, seo_labels)
        print(f"   logic_agent  → {logic_result['best_label']} ({logic_result['confidence']})")
