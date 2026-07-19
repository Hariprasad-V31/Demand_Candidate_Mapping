// Script to generate the Master Skill Map from the authoritative mapping table
const fs = require("fs");

// Master table: row 0 = core skill headers, rows 1+ = detail skills at various levels
// Tab-separated, parsed from the user-provided skill mapping reference
const MASTER_TABLE = [
  // [coreSkill, [detailSkills...]]
  ["By WMS Dispatcher", ["Blue Yonder WMS"]],
  ["Java", ["Core Java", "Advanced Java Concepts", "Java - JDBC", "Java Architecture", "Java API Management & Microservices"]],
  ["ReactJS", ["Digital : ReactJS"]],
  ["Spring Boot", ["Spring Boot"]],
  ["Microservices", ["Microservices"]],
  ["Databricks", ["Databricks", "PySpark", "Azure Databricks"]],
  ["Data Engineering", ["Google Data Engineering"]],
  ["Python", ["Python"]],
  ["Angular", ["AngularJS", "Angular 2", "Angular4", "Angular5", "Angular 7", "Angular 8", "Angular 9"]],
  ["DevOps", ["DevOps", "Terraform", "Cloud DevOps"]],
  ["Database Engineer (Oracle)", ["ORACLE SQL", "Oracle DBA", "Oracle Database 12C Administration", "Oracle Database Administration", "DataGaurd"]],
  ["Linux", ["Unix / Linux Basics and Commands", "RedHat Linux"]],
  ["Automation Testing", ["Selenium", "Test Automation", "TOSCA"]],
  ["Manual Testing", ["Testing Concepts, Process and Methodology", "Manual Testing Processes and Management", "Functional Testing"]],
  ["SAP ABAP", ["SAP Advanced Business Application Programming (ABAP) for non-HANA"]],
  ["SAP BASIS", ["SAP BASIS - HANA"]],
  ["RPA", ["Robotic Process Automation - UiPath", "Robotic Process Automation - BluePrism"]],
  ["STIBO", ["STIBO Master Data Management"]],
  ["VMWare", ["VMWare", "VMware vSphere"]],
  ["Network Engineer", ["IT IS_CNS_Wireless Network_Cisco", "Network Switching(LAN Technology)", "Network Security", "EIS : Network Engineer", "FortiGate SD-WAN"]],
  ["Mulesoft", ["MuleSoft"]],
  ["PLM", ["(PLM)"]],
  ["PeopleSoft", ["Oracle PeopleSoft Core HR"]],
  ["Product Management", ["Product Management"]],
  ["Program Management", ["Program Management"]],
  ["Solution Architect", ["Solution and Functional Architect (SAFA)"]],
  ["Business Analyst", ["Business Analysis"]],
  ["Cybersecurity", ["Cyber Security", "Cyber Security - Phishing", "Cyber Security - GRC - Data Security"]],
  ["Oracle HCM", ["Oracle JDE EnterpriseOne Human Capital Management"]],
  ["Power BI", ["Microsoft Power BI"]],
  ["MiddleWare", ["IT IS_AMS_MiddleWare_WAS"]],
  ["Performance Testing", ["Performance Testing"]],
  ["Mainframe", ["COBOL", "Mainframe DB2 - Application Development", "IT IS_AMS_Mainframe_DB2 Administration"]],
  ["Apigee", ["APIGEE"]],
  ["SQL Developer", ["MySQL", "ORACLE SQL", "PL/SQL"]],
  ["SCCM Engineer", ["EUCS_TOOLS_SCCM", "MECM"]],
  ["Data Modeller", ["Data Warehouse", "Data Concepts & Data Modelling"]],
  ["Incident Manager", ["Incident Management"]],
  ["Change Management", ["Change Management"]],
  ["Data Stage", ["IBM InfoSphere DataStage"]],
  ["SharePoint Admin", ["SharePoint 2016"]],
  ["Core Microsoft 365 Administration", ["Office 365 Administration"]],
  ["VMO Lead", ["SCM - Vendor Management"]],
  ["Software Asset Manager", ["ITAM (IT Asset Management)"]],
  ["Sterling OMS", ["IBM Sterling Commerce OMS"]],
  ["BY Work Force Management", ["BY Work Force Management Consultant", "BY WFM"]],
  ["SAP S4 HANA Finance", ["SAP S/4HANA - Central Finance"]],
  ["IBM WMQ", ["IBM Websphere MQ Series", "Azure Service Bus"]],
  ["ITAM", ["CMDB Management"]],
  ["Intune", ["Microsoft Intune", "MDM"]],
  ["SAP BTP", ["SAP Business Technology Platform (BTP) - Integration Suite"]],
];

// Generate the JS module
let output = `// Master Skill Table - Authoritative skill mapping
// Generated from the official skill mapping reference table
// ONLY these mappings are valid for candidate processing
// 51 core skills, ~120 detail skill variants

export const MASTER_SKILL_MAP = {\n`;

for (const [core, details] of MASTER_TABLE) {
  output += `  ${JSON.stringify(core)}: [\n`;
  for (const d of details) {
    output += `    ${JSON.stringify(d)},\n`;
  }
  output += `  ],\n`;
}

output += `};\n\n`;
output += `// List of valid core skill categories (for constraining AI demand classification)\n`;
output += `export const CORE_SKILL_LIST = Object.keys(MASTER_SKILL_MAP);\n\n`;
output += `// Build reverse map: normalized detail skill name -> core skill.\n`;
output += `// Accepts an optional map so callers can build a reverse index for a custom\n`;
output += `// (user-edited) mapping; defaults to the built-in Master Skill Table.\n`;
output += `export function buildMasterReverseMap(map = MASTER_SKILL_MAP) {\n`;
output += `  const reverse = new Map();\n`;
output += `  for (const [core, details] of Object.entries(map)) {\n`;
output += `    for (const detail of details) {\n`;
output += `      // Index the full normalized name\n`;
output += `      const norm = detail.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\\s+/g, " ").trim();\n`;
output += `      reverse.set(norm, core);\n`;
output += `      // Also index without category prefix (e.g. "Digital : ReactJS" -> "reactjs")\n`;
output += `      const idx = detail.indexOf(" : ");\n`;
output += `      if (idx !== -1) {\n`;
output += `        const stripped = detail.slice(idx + 3).toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\\s+/g, " ").trim();\n`;
output += `        reverse.set(stripped, core);\n`;
output += `      }\n`;
output += `      // Also index the raw detail name as-is (case-insensitive)\n`;
output += `      reverse.set(detail.toLowerCase(), core);\n`;
output += `    }\n`;
output += `    // Also map the core skill name itself\n`;
output += `    reverse.set(core.toLowerCase(), core);\n`;
output += `    const normCore = core.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\\s+/g, " ").trim();\n`;
output += `    reverse.set(normCore, core);\n`;
output += `  }\n`;
output += `  return reverse;\n`;
output += `}\n`;

fs.writeFileSync("shared/masterSkillMap.js", output);
console.log("✓ Generated shared/masterSkillMap.js");
console.log(`  ${MASTER_TABLE.length} core skills`);
console.log(`  ${MASTER_TABLE.reduce((s, [, d]) => s + d.length, 0)} detail skills`);
