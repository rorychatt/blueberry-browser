use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub struct OllamaAgent {
    endpoint: String,
    model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentResponse {
    pub success: bool,
    pub reason: String,
}

impl OllamaAgent {
    pub fn new() -> Self {
        // Read from environment or fallback to defaults
        let endpoint = std::env::var("OLLAMA_ENDPOINT")
            .unwrap_or_else(|_| "http://localhost:11434".to_string());
        let model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "opencode".to_string());

        Self { endpoint, model }
    }

    pub async fn assert(
        &self,
        prompt: &str,
        page_text: &str,
        console_logs: &str,
        network_events: &str,
    ) -> Result<AgentResponse> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .build()?;

        let mut values = std::collections::HashMap::new();
        values.insert("Assertion".to_string(), prompt.to_string());
        values.insert("PageContent".to_string(), page_text.to_string());
        values.insert("ConsoleLogs".to_string(), console_logs.to_string());
        values.insert("NetworkEvents".to_string(), network_events.to_string());

        let (system, user) =
            crate::promptware::compile_prompt_system_and_user("AssertionAgent", &values)?;

        let body = serde_json::json!({
            "model": self.model,
            "system": system,
            "prompt": user,
            "stream": false,
            "options": {
                "temperature": 0.1
            }
        });

        let url = format!("{}/api/generate", self.endpoint);

        let response = client.post(&url).json(&body).send().await.map_err(|e| {
            anyhow!(
                "Failed to send request to Ollama ({}): {}. Make sure Ollama is running local.",
                url,
                e
            )
        })?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Ollama returned error status: {}",
                response.status()
            ));
        }

        let resp_json: serde_json::Value = response.json().await?;
        let output_text = resp_json["response"]
            .as_str()
            .ok_or_else(|| anyhow!("Ollama response did not contain a response text string"))?
            .trim();

        // Extract JSON block if the model wrapped it in markdown code blocks
        let clean_text = if output_text.starts_with("```json") {
            let without_start = output_text.strip_prefix("```json").unwrap_or(output_text);
            let without_end = without_start.strip_suffix("```").unwrap_or(without_start);
            without_end.trim()
        } else if output_text.starts_with("```") {
            let without_start = output_text.strip_prefix("```").unwrap_or(output_text);
            let without_end = without_start.strip_suffix("```").unwrap_or(without_start);
            without_end.trim()
        } else {
            output_text
        };

        // Try to parse the response as our AgentResponse struct
        let agent_resp: AgentResponse = serde_json::from_str(clean_text).map_err(|e| {
            anyhow!(
                "Failed to parse Agent Response as JSON. Cleaned model output: '{}'. Error: {}",
                clean_text,
                e
            )
        })?;

        Ok(agent_resp)
    }

    pub async fn generate_raw(&self, prompt: &str) -> Result<String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .build()?;

        let body = serde_json::json!({
            "model": self.model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": 0.1
            }
        });

        let url = format!("{}/api/generate", self.endpoint);

        let response = client.post(&url).json(&body).send().await.map_err(|e| {
            anyhow!(
                "Failed to send request to Ollama ({}): {}. Make sure Ollama is running local.",
                url,
                e
            )
        })?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Ollama returned error status: {}",
                response.status()
            ));
        }

        let resp_json: serde_json::Value = response.json().await?;
        let output_text = resp_json["response"]
            .as_str()
            .ok_or_else(|| anyhow!("Ollama response did not contain a response text string"))?
            .trim()
            .to_string();

        Ok(output_text)
    }

    pub async fn generate_with_system(&self, system: &str, prompt: &str) -> Result<String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .build()?;

        let body = serde_json::json!({
            "model": self.model,
            "system": system,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": 0.1
            }
        });

        let url = format!("{}/api/generate", self.endpoint);

        let response = client.post(&url).json(&body).send().await.map_err(|e| {
            anyhow!(
                "Failed to send request to Ollama ({}): {}. Make sure Ollama is running local.",
                url,
                e
            )
        })?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Ollama returned error status: {}",
                response.status()
            ));
        }

        let resp_json: serde_json::Value = response.json().await?;
        let output_text = resp_json["response"]
            .as_str()
            .ok_or_else(|| anyhow!("Ollama response did not contain a response text string"))?
            .trim()
            .to_string();

        Ok(output_text)
    }
}
