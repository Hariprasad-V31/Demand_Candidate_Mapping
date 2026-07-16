// Master Skill Table - Authoritative skill mapping
// Generated from the official skill mapping reference table
// ONLY these mappings are valid for candidate processing
// 52 core skills, ~120 detail skill variants

export const MASTER_SKILL_MAP = {
  "By WMS Dispatcher": [
    "Blue Yonder WMS",
  ],
  "Java": [
    "Core Java",
    "Advanced Java Concepts",
    "Java - JDBC",
    "Java Architecture",
    "Java API Management & Microservices",
  ],
  "ReactJS": [
    "Digital : ReactJS",
  ],
  "Spring Boot": [
    "Spring Boot",
  ],
  "Microservices": [
    "Microservices",
  ],
  "Databricks": [
    "Databricks",
    "PySpark",
    "Azure Databricks",
  ],
  "Data Engineering": [
    "Google Data Engineering",
  ],
  "Azure": [
    "Microsoft Azure",
  ],
  "Python": [
    "Python",
  ],
  "Angular": [
    "AngularJS",
    "Angular 2",
    "Angular4",
    "Angular5",
    "Angular 7",
    "Angular 8",
    "Angular 9",
  ],
  "DevOps": [
    "DevOps",
    "Terraform",
    "Cloud DevOps",
  ],
  "Database Engineer (Oracle)": [
    "ORACLE SQL",
    "Oracle DBA",
    "Oracle Database 12C Administration",
    "Oracle Database Administration",
    "DataGaurd",
  ],
  "Linux": [
    "Unix / Linux Basics and Commands",
    "RedHat Linux",
  ],
  "Automation Testing": [
    "Selenium",
    "Test Automation",
    "TOSCA",
  ],
  "Manual Testing": [
    "Testing Concepts, Process and Methodology",
    "Manual Testing Processes and Management",
    "Functional Testing",
  ],
  "SAP ABAP": [
    "SAP Advanced Business Application Programming (ABAP) for non-HANA",
  ],
  "SAP BASIS": [
    "SAP BASIS - HANA",
  ],
  "RPA": [
    "Robotic Process Automation - UiPath",
    "Robotic Process Automation - BluePrism",
  ],
  "STIBO": [
    "STIBO Master Data Management",
  ],
  "VMWare": [
    "VMWare",
    "VMware vSphere",
  ],
  "Network Engineer": [
    "IT IS_CNS_Wireless Network_Cisco",
    "Network Switching(LAN Technology)",
    "Network Security",
    "EIS : Network Engineer",
    "FortiGate SD-WAN",
  ],
  "Mulesoft": [
    "MuleSoft",
  ],
  "PLM": [
    "(PLM)",
  ],
  "PeopleSoft": [
    "Oracle PeopleSoft Core HR",
  ],
  "Product Management": [
    "Product Management",
  ],
  "Program Management": [
    "Program Management",
  ],
  "Solution Architect": [
    "Solution and Functional Architect (SAFA)",
  ],
  "Business Analyst": [
    "Business Analysis",
  ],
  "Cybersecurity": [
    "Cyber Security",
    "Cyber Security - Phishing",
    "Cyber Security - GRC - Data Security",
  ],
  "Oracle HCM": [
    "Oracle JDE EnterpriseOne Human Capital Management",
  ],
  "Power BI": [
    "Microsoft Power BI",
  ],
  "MiddleWare": [
    "IT IS_AMS_MiddleWare_WAS",
  ],
  "Performance Testing": [
    "Performance Testing",
  ],
  "Mainframe": [
    "COBOL",
    "Mainframe DB2 - Application Development",
    "IT IS_AMS_Mainframe_DB2 Administration",
  ],
  "Apigee": [
    "APIGEE",
  ],
  "SQL Developer": [
    "MySQL",
    "ORACLE SQL",
    "PL/SQL",
  ],
  "SCCM Engineer": [
    "EUCS_TOOLS_SCCM",
    "MECM",
  ],
  "Data Modeller": [
    "Data Warehouse",
    "Data Concepts & Data Modelling",
  ],
  "Incident Manager": [
    "Incident Management",
  ],
  "Change Management": [
    "Change Management",
  ],
  "Data Stage": [
    "IBM InfoSphere DataStage",
  ],
  "SharePoint Admin": [
    "SharePoint 2016",
  ],
  "Core Microsoft 365 Administration": [
    "Office 365 Administration",
  ],
  "VMO Lead": [
    "SCM - Vendor Management",
  ],
  "Software Asset Manager": [
    "ITAM (IT Asset Management)",
  ],
  "Sterling OMS": [
    "IBM Sterling Commerce OMS",
  ],
  "BY Work Force Management": [
    "BY Work Force Management Consultant",
    "BY WFM",
  ],
  "SAP S4 HANA Finance": [
    "SAP S/4HANA - Central Finance",
  ],
  "IBM WMQ": [
    "IBM Websphere MQ Series",
    "Azure Service Bus",
  ],
  "ITAM": [
    "CMDB Management",
  ],
  "Intune": [
    "Microsoft Intune",
    "MDM",
  ],
  "SAP BTP": [
    "SAP Business Technology Platform (BTP) - Integration Suite",
  ],
};

// List of valid core skill categories (for constraining AI demand classification)
export const CORE_SKILL_LIST = Object.keys(MASTER_SKILL_MAP);

// Build reverse map: normalized detail skill name -> core skill
export function buildMasterReverseMap() {
  const reverse = new Map();
  for (const [core, details] of Object.entries(MASTER_SKILL_MAP)) {
    for (const detail of details) {
      // Index the full normalized name
      const norm = detail.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      reverse.set(norm, core);
      // Also index without category prefix (e.g. "Digital : ReactJS" -> "reactjs")
      const idx = detail.indexOf(" : ");
      if (idx !== -1) {
        const stripped = detail.slice(idx + 3).toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        reverse.set(stripped, core);
      }
      // Also index the raw detail name as-is (case-insensitive)
      reverse.set(detail.toLowerCase(), core);
    }
    // Also map the core skill name itself
    reverse.set(core.toLowerCase(), core);
    const normCore = core.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    reverse.set(normCore, core);
  }
  return reverse;
}
