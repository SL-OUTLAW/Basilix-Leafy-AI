# Leafy AI LLM

Provides main LLM brain for Leafy AI.

Uses a local Ollama model `qwen3.5:9b-q4_K_M` to interpret user requests, process farm information, use available capabilities when required, and return a structured response for the rest of the Leafy system.

---

### `llm_client.py`

Main entry point for the LLM.

It:

- loads the system prompt and response schema
- sends requests to Ollama
- handles native capability calls
- executes approved Python capabilities
- returns capability results to the model
- generates the final structured response
- validates the final response

Main function:

```python
leafy_ai(messages)
```

### `llm_tools.py`

Contains the tools available to the LLM.

Capabilities are implemented as normal Python functions and registered in:

```python
TOOLS = [...]
```

The internal mapping:

```python
AVAILABLE_TOOLS = {
    tool.__name__: tool
    for tool in TOOLS
}
```

is used to route model requests to the correct Python function.

Internal capability names should not be exposed in user-facing responses.

### `system_prompt.md`

Contains Leafy's behavioural instructions, including:

- Leafy identity and role
- farm-specific information
- data handling rules
- safety requirements
- capability-use rules
- anti-hallucination rules
- response behaviour
- output requirements

The prompt is loaded at runtime so it can be changed without rebuilding the Ollama model.

### `schema.json`

Defines the structure of the final response returned by Leafy AI.

Current response types are:

```text
chat
recommended_action
farm_analysis
```

The schema is used with Ollama structured output to ensure the final response follows the expected format.

---

### `Modelfile`

Defines the base Ollama model and stable model parameters.

Create the model with:

```bash
ollama create leafy-ai -f Modelfile
```

Run it with:

```bash
ollama run leafy-ai
```

## Running

Make sure Ollama is running and the model exists:

```bash
ollama list
```

Then run:

```bash
python llm_client.py
```

The model is kept loaded with:

```python
keep_alive=-1
```
