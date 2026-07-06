use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestSuite {
    pub name: String,
    pub steps: Vec<TestStep>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum TestStep {
    Navigate(String),
    Click(String),
    Type(TypeStep),
    Wait(u64),
    #[serde(rename = "wait_for")]
    WaitFor(String),
    Screenshot(String),
    Agent(String),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypeStep {
    pub selector: String,
    pub text: String,
}

impl TestSuite {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let mut file = File::open(path)
            .map_err(|e| anyhow!("Failed to open YAML test file: {}", e))?;
        
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| anyhow!("Failed to read YAML test file: {}", e))?;

        let suite: TestSuite = serde_yaml::from_str(&contents)
            .map_err(|e| anyhow!("Failed to parse YAML E2E test file: {}", e))?;

        Ok(suite)
    }
}
