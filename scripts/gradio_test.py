"""
AI Agent Testing Dashboard
===========================
Gradio-based dashboard for testing different AI models.
Run with: python scripts/gradio_test.py
Dashboard will be available at: http://localhost:7860
"""

import gradio as gr
import os
from transformers import pipeline
import json

# ========================================
# MODEL REGISTRY
# ========================================
# Add new models here and they'll appear in dropdown

MODELS_DIR = "models"

def get_available_models():
    """Scan models directory and return available models"""
    models = []
    if os.path.exists(MODELS_DIR):
        for folder in os.listdir(MODELS_DIR):
            model_path = os.path.join(MODELS_DIR, folder)
            if os.path.isdir(model_path):
                config_path = os.path.join(model_path, "config.json")
                if os.path.exists(config_path):
                    # Read config to determine model type
                    with open(config_path, 'r') as f:
                        config = json.load(f)
                    
                    # Determine model type based on folder name and config
                    model_type = "text-classification"  # default
                    name_or_path = config.get("_name_or_path", "").lower()
                    folder_lower = folder.lower()
                    
                    # Check for zero-shot models (BART, MNLI, logic_agent, deberta)
                    if ("logic" in folder_lower or 
                        "bart" in folder_lower or 
                        "deberta" in folder_lower or
                        "mnli" in name_or_path or
                        "bart" in name_or_path or
                        "facebook" in name_or_path or
                        "nli" in name_or_path):
                        model_type = "zero-shot-classification"
                    
                    models.append({
                        "name": folder,
                        "path": model_path,
                        "type": model_type
                    })
    # Add Ollama Qwen model - we installed it earlier
    # Always add since installation confirmed via terminal
    models.append({
        "name": "qwen2.5_agent (Ollama)",
        "path": "qwen2.5:7b-instruct",
        "type": "ollama-llm"
    })
    print("[DEBUG] Qwen2.5 model added")
    
    # Fallback if no local models found
    if not models:
        models = [
            {"name": "intent_agent (Hugging Face)", "path": "Falconsai/intent_classification", "type": "text-classification"},
            {"name": "logic_agent (Hugging Face)", "path": "facebook/bart-large-mnli", "type": "zero-shot-classification"}
        ]
    
    return models


DEFAULT_SEO_PROMPT = '''Classify this SEO search keyword into ONE category based on user intent:

CATEGORIES:
- Commercial = wants to buy, price, compare, best (e.g., "buy machine", "price of twister", "best winding machine")
- Informational = wants to learn, understand (e.g., "what is tfo", "how yarn twisting works", "types of machines")
- Transactional = wants to take action NOW (e.g., "order machine", "get quote", "contact manufacturer")
- Navigational = looking for specific company/website (e.g., "meera industries", "alidhra website", "company name")

KEYWORD: "{keyword}"

Think step by step:
1. Does it have "buy", "price", "cost", "best", "cheap"? → Commercial
2. Does it have "what", "how", "why", "types", "meaning"? → Informational  
3. Does it have "order", "quote", "contact", "enquiry"? → Transactional
4. Is it a company/brand name only? → Navigational
5. Default for product searches without clear signals → Commercial

ANSWER (one word only):'''


def query_ollama(text: str, labels: list, custom_prompt: str = "") -> dict:
    """Query Ollama Qwen model for classification with customizable prompt"""
    import subprocess
    import os as os_module
    
    # Use custom prompt if provided, otherwise use default
    if custom_prompt.strip():
        prompt = custom_prompt.replace("{keyword}", text).replace("{labels}", ", ".join(labels))
    else:
        prompt = DEFAULT_SEO_PROMPT.replace("{keyword}", text).replace("{labels}", ", ".join(labels))
    
    try:
        # Set OLLAMA_MODELS to D: drive
        env = os_module.environ.copy()
        env['OLLAMA_MODELS'] = 'D:\\OllamaModels'
        
        # Escape quotes in prompt for command line
        escaped_prompt = prompt.replace('"', '\\"').replace('\n', ' ')
        
        result = subprocess.run(
            f'ollama run qwen2.5:7b-instruct "{escaped_prompt}"',
            capture_output=True,
            text=True,
            timeout=60,
            shell=True,
            env=env
        )
        response = result.stdout.strip().split()[0] if result.stdout.strip() else ""
        
        # Find which label matches best
        best_label = labels[0]  # default
        response_lower = response.lower()
        for label in labels:
            if label.lower() in response_lower or response_lower in label.lower():
                best_label = label
                break
        
        return {"label": best_label, "raw_response": response}
    except Exception as e:
        return {"label": "Error", "raw_response": str(e)}

# Load models lazily
loaded_models = {}

def get_model(model_info):
    """Load model lazily and cache it"""
    key = model_info["name"]
    if key not in loaded_models:
        print(f"Loading model: {model_info['name']}...")
        loaded_models[key] = pipeline(model_info["type"], model=model_info["path"])
        print(f"✅ {model_info['name']} loaded!")
    return loaded_models[key], model_info["type"]

# ========================================
# INFERENCE FUNCTIONS
# ========================================

def analyze_text(text: str, model_name: str, custom_labels: str = "", system_prompt: str = "") -> str:
    """Main inference function"""
    if not text.strip():
        return "⚠️ Please enter some text to analyze."
    
    # Find model info
    models = get_available_models()
    model_info = next((m for m in models if m["name"] == model_name), None)
    
    if not model_info:
        return f"❌ Model '{model_name}' not found."
    
    # Parse custom labels
    if custom_labels.strip():
        labels = [l.strip() for l in custom_labels.split(",")]
    else:
        labels = ["Commercial", "Informational", "Navigational", "Transactional"]
    
    try:
        # Handle Ollama LLM models (Qwen)
        if model_info["type"] == "ollama-llm":
            result = query_ollama(text, labels, system_prompt)
            output = f"🧠 **Model**: {model_name}\n"
            output += f"📝 **Input**: {text}\n\n"
            output += f"**Classification**: **{result['label']}**\n"
            output += f"**Raw Response**: _{result['raw_response']}_"
            return output
        
        model, model_type = get_model(model_info)
        
        if model_type == "zero-shot-classification":
            result = model(text, labels)
            
            # Format output
            output = f"🧠 **Model**: {model_name}\n"
            output += f"📝 **Input**: {text}\n\n"
            output += "**Results:**\n"
            for label, score in zip(result["labels"], result["scores"]):
                bar = "█" * int(score * 20)
                output += f"  • {label}: {score:.1%} {bar}\n"
            
        else:  # text-classification
            result = model(text)
            output = f"🧠 **Model**: {model_name}\n"
            output += f"📝 **Input**: {text}\n\n"
            output += "**Results:**\n"
            for r in result:
                output += f"  • **{r['label']}**: {r['score']:.1%}\n"
        
        return output
        
    except Exception as e:
        return f"❌ Error: {str(e)}"


def analyze_batch(file, model_name: str, custom_labels: str = "", system_prompt: str = ""):
    """Batch analysis for CSV/TXT files with CSV export"""
    if file is None:
        return "⚠️ Please upload a file.", None
    
    try:
        import pandas as pd
        
        # Read file
        if file.name.endswith('.csv'):
            df = pd.read_csv(file.name)
            texts = df.iloc[:, 0].tolist()[:100]  # First column, max 100
        else:
            with open(file.name, 'r') as f:
                texts = [line.strip() for line in f.readlines()[:100]]
        
        # Find model info
        models = get_available_models()
        model_info = next((m for m in models if m["name"] == model_name), None)
        
        if not model_info:
            return f"❌ Model '{model_name}' not found.", None
        
        model_type = model_info["type"]
        
        # Parse custom labels
        if custom_labels.strip():
            labels = [l.strip() for l in custom_labels.split(",")]
        else:
            labels = ["Commercial", "Informational", "Navigational", "Transactional"]
        
        # Only load HuggingFace model if not Ollama
        if model_type != "ollama-llm":
            model, model_type = get_model(model_info)
        
        results_display = []
        results_csv = []
        
        for text in texts:
            if not text.strip():
                continue
            
            # Handle Ollama LLM models
            if model_type == "ollama-llm":
                result = query_ollama(text, labels, system_prompt)
                best_label = result["label"]
                best_score = 1.0  # Ollama doesn't give scores
                all_scores = {best_label: 1.0}
            elif model_type == "zero-shot-classification":
                result = model(text, labels)
                best_label = result["labels"][0]
                best_score = result["scores"][0]
                all_scores = {l: s for l, s in zip(result["labels"], result["scores"])}
            else:
                result = model(text)
                best_label = result[0]["label"]
                best_score = result[0]["score"]
                all_scores = {r["label"]: r["score"] for r in result}
            
            # Display result
            results_display.append(f"📌 **{text}** → **{best_label}** ({best_score:.1%})")
            
            # CSV row
            csv_row = {
                "keyword": text,
                "best_label": best_label,
                "confidence": round(best_score, 3)
            }
            # Add all label scores
            for label, score in all_scores.items():
                csv_row[f"score_{label}"] = round(score, 3)
            results_csv.append(csv_row)
        
        # Create CSV file with unique timestamp
        import time
        timestamp = int(time.time())
        csv_path = f"data/ai_results_{timestamp}.csv"
        results_df = pd.DataFrame(results_csv)
        results_df.to_csv(csv_path, index=False)
        
        display_text = f"### Results ({len(results_csv)} keywords analyzed)\n\n"
        display_text += "\n".join(results_display[:50])  # Show first 50
        if len(results_csv) > 50:
            display_text += f"\n\n... and {len(results_csv) - 50} more (see CSV)"
        display_text += f"\n\n✅ **CSV exported to:** `{csv_path}`"
        
        return display_text, csv_path
        
    except Exception as e:
        import traceback
        return f"❌ Error: {str(e)}\n{traceback.format_exc()}", None


# ========================================
# GRADIO INTERFACE
# ========================================

def create_dashboard():
    models = get_available_models()
    model_names = [m["name"] for m in models]
    
    with gr.Blocks(title="AI Agent Test Dashboard", theme=gr.themes.Soft()) as demo:
        gr.Markdown("""
        # 🧠 AI Agent Test Dashboard
        Test different AI models for intent classification and text analysis.
        """)
        
        with gr.Row():
            with gr.Column(scale=2):
                # Model selector
                model_dropdown = gr.Dropdown(
                    choices=model_names,
                    value=model_names[0] if model_names else None,
                    label="Select AI Model",
                    info="Choose which AI agent to use"
                )
                
                # Custom labels (for zero-shot)
                custom_labels = gr.Textbox(
                    label="Custom Labels",
                    value="Commercial, Informational, Transactional, Navigational",
                    placeholder="Commercial, Informational, Transactional, Navigational",
                    info="Comma-separated labels for classification"
                )
                
                # System Prompt for Qwen
                with gr.Accordion("📝 System Prompt (for qwen2.5_agent)", open=False):
                    system_prompt = gr.Textbox(
                        label="Classification Prompt",
                        value=DEFAULT_SEO_PROMPT,
                        lines=15,
                        info="Use {keyword} and {labels} as placeholders. They will be replaced with actual values."
                    )
                
            with gr.Column(scale=1):
                gr.Markdown("""
                ### 📋 Installed Models
                """)
                for m in models:
                    gr.Markdown(f"• **{m['name']}** ({m['type']})")
        
        with gr.Tabs():
            with gr.TabItem("📝 Single Text"):
                text_input = gr.Textbox(
                    label="Enter Text to Analyze",
                    placeholder="e.g., 'buy twisting machine online' or 'what is yarn twisting'",
                    lines=3
                )
                analyze_btn = gr.Button("🔍 Analyze", variant="primary")
                output = gr.Markdown(label="Results")
                
                analyze_btn.click(
                    analyze_text,
                    inputs=[text_input, model_dropdown, custom_labels, system_prompt],
                    outputs=output
                )
            
            with gr.TabItem("📁 Batch Upload"):
                gr.Markdown("Upload a CSV or TXT file with keywords (one per line or first column)")
                file_input = gr.File(label="Upload File", file_types=[".csv", ".txt"])
                batch_btn = gr.Button("🔍 Analyze Batch & Export CSV", variant="primary")
                batch_output = gr.Markdown(label="Batch Results")
                csv_download = gr.File(label="📥 Download Results CSV")
                
                batch_btn.click(
                    analyze_batch,
                    inputs=[file_input, model_dropdown, custom_labels, system_prompt],
                    outputs=[batch_output, csv_download]
                )
        
        gr.Markdown("""
        ---
        **Tips:**
        - `intent_agent`: Fast intent classification (pre-trained labels)
        - `logic_agent`: Flexible zero-shot classification (use custom labels!)
        - Add new models to `models/` folder and they'll appear automatically
        """)
    
    return demo


if __name__ == "__main__":
    print("🚀 Starting AI Agent Test Dashboard...")
    print("📍 Dashboard will be available at: http://localhost:7860")
    demo = create_dashboard()
    demo.launch(server_port=7860, share=False)
