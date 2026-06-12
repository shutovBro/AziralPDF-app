use std::path::PathBuf;

pub fn app_data_dir() -> PathBuf {
    if cfg!(target_os = "macos") {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("AziralPDF")
    } else if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA")
            .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());
        PathBuf::from(appdata).join("AziralPDF")
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(home).join(".config").join("AziralPDF")
    }
}

pub fn system_provisioning_dir() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        let program_data = std::env::var("PROGRAMDATA").ok()?;
        Some(PathBuf::from(program_data).join("AziralPDF"))
    } else if cfg!(target_os = "macos") {
        Some(PathBuf::from("/Library").join("Application Support").join("AziralPDF"))
    } else if cfg!(target_os = "linux") {
        Some(PathBuf::from("/etc").join("aziral-pdf"))
    } else {
        None
    }
}
