use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestSuite {
    pub name: String,
    pub steps: Option<Vec<TestStep>>,
    pub prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestStep {
    pub navigate: Option<String>,
    pub click: Option<String>,
    #[serde(rename = "type")]
    pub type_step: Option<TypeStep>,
    pub wait: Option<u64>,
    #[serde(rename = "wait_for")]
    pub wait_for: Option<String>,
    pub screenshot: Option<String>,
    pub agent: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypeStep {
    pub selector: String,
    pub text: String,
}

impl TestSuite {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let mut file =
            File::open(path).map_err(|e| anyhow!("Failed to open YAML test file: {}", e))?;

        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| anyhow!("Failed to read YAML test file: {}", e))?;

        let suite: TestSuite = serde_yaml::from_str(&contents)
            .map_err(|e| anyhow!("Failed to parse YAML E2E test file: {}", e))?;

        Ok(suite)
    }
}
