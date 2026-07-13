// Shared detail-skill -> core-skill mapping.
// Used by both the frontend web UI and the Copilot Extension.
// Each list holds "Skill Name [ Ex" prefixes; only the skill name part is used for lookup.
export const SKILL_MAP = {
  Java: ["Core Java [ E1", "Core Java [ E2", "Core Java [ E3", "Core Java [ E4", "Advanced Java Concepts [ E1", "Advanced Java Concepts [ E2", "Advanced Java Concepts [ E3", "Java - JDBC [ E1", "Java - JDBC [ E2", "Java - JDBC [ E3", "Java Architecture [ E1", "Java Architecture [ E2", "Java Architecture [ E3"],
  ReactJS: ["Digital : ReactJS [ E1", "Digital : ReactJS [ E2", "Digital : ReactJS [ E3", "Digital : ReactJS [ E1", "Digital : ReactJS [ E2", "Digital : ReactJS [ E3"],
  "Spring Boot": ["Spring Boot [ E1", "Spring Boot [ E2", "Spring Boot [ E3"],
  Microservices: ["Microservices [ E1", "Microservices [ E2", "Microservices [ E3", "Java API Management &amp; Microservices [ E1", "Java API Management &amp; Microservices [ E2", "Java API Management &amp; Microservices [ E3"],
  Databricks: ["Databricks [ E1", "Databricks [ E2", "Databricks [ E3", "PySpark [ E1", "PySpark [ E2", "PySpark [ E3"],
  "Data Engineering": ["Google Data Engineering [ E1", "Google Data Engineering [ E2", "Google Data Engineering [ E3"],
  Python: ["Python [ E1", "Python [ E1", "Python [ E2", "Python [ E2", "Python [ E3", "Python [ E3", "Python [ E4"],
  Angular: ["AngularJS [ E1", "AngularJS [ E1", "Angular 2 [ E1", "Angular 2 [ E2", "Angular4 [ E1", "Angular5 [ E1", "Angular 8 [ E1", "Angular 9 [ E1", "Angular 9 [ E2", "Angular 9 [ E3", "Angular 9 [ E4", "Angular 7 [ E1", "Angular 7 [ E2", "Angular 7 [ E3"],
  DevOps: ["DevOps [ E1", "DevOps [ E1", "DevOps [ E2", "DevOps [ E3", "Terraform [ E0", "Terraform [ E1", "Terraform [ E2", "Cloud DevOps [ E1", "Cloud DevOps [ E2", "Cloud DevOps [ E3"],
  "Database Engineer (Oracle)": ["ORACLE SQL [ E1", "ORACLE SQL [ E2", "ORACLE SQL [ E3", "Oracle DBA [ E1", "Oracle DBA [ E2", "Oracle DBA [ E3", "Oracle DBA [ E4", "Oracle Database 12C Administration [ E1", "Oracle Database 12C Administration [ E2", "Oracle Database 12C Administration [ E3", "Oracle Database Administration [ E1", "Oracle Database Administration [ E2", "Oracle Database Administration [ E3", "Data Guard [ E1", "Data Guard [ E2", "Data Guard [ E3", "Data Guard [ E4"],
  Linux: ["Unix / Linux Basics and Commands [ E1", "Unix / Linux Basics and Commands [ E2", "Unix / Linux Basics and Commands [ E3", "RedHat Linux [ E1", "RedHat Linux [ E2", "RedHat Linux [ E3"],
  "Automation tesing": ["Selenium [ E1", "Selenium [ E2", "Selenium [ E3", "Test Automation [ E1", "Test Automation [ E2", "Test Automation [ E3", "Test Automation [ E4", "TOSCA [ E1", "TOSCA [ E2", "TOSCA [ E3"],
  "Manual Testing": ["Testing Concepts, Process and Methodology [ E1", "Testing Concepts, Process and Methodology [ E2", "Testing Concepts, Process and Methodology [ E3", "Manual Testing Processes and Management [ E1", "Manual Testing Processes and Management [ E2", "Manual Testing Processes and Management [ E3", "Functional Testing [ E1", "Functional Testing [ E2", "Functional Testing [ E3"],
  "SAP ABAP": ["SAP Advanced Business Application Programming (ABAP) for non-HANA [ E1", "SAP Advanced Business Application Programming (ABAP) for non-HANA [ E2", "SAP Advanced Business Application Programming (ABAP) for non-HANA [ E3"],
  "SAP BASIS": ["SAP BASIS - HANA [ E1", "SAP BASIS - HANA [ E2", "SAP BASIS - HANA [ E3"],
  RPA: ["Robotic Process Automation - UiPath [ E1", "Robotic Process Automation - UiPath [ E2", "Robotic Process Automation - UiPath [ E3", "Robotic Process Automation - BluePrism [ E1", "Robotic Process Automation - BluePrism [ E2", "Robotic Process Automation - BluePrism [ E3"],
  STIBO: ["STIBO Master Data Management [ E1", "STIBO Master Data Management [ E2", "STIBO Master Data Management [ E3"],
  VMWare: ["VMWare [ E1", "VMWare [ E2", "VMWare [ E3", "VMware vSphere [ E1", "VMware vSphere [ E2", "VMware vSphere [ E3"],
  "Network engineer": ["IT IS_CNS_Wireless Network_Cisco [ E1", "IT IS_CNS_Wireless Network_Cisco [ E2", "IT IS_CNS_Wireless Network_Cisco [ E3", "Network Switching(LAN Technology) [ E1", "Network Switching(LAN Technology) [ E2", "Network Switching(LAN Technology) [ E3", "Network Security [ E1", "Network Security [ E2", "EIS : Network Engineer [ E1", "EIS : Network Engineer [ E2", "FortiGate SD-WAN [ E1", "FortiGate SD-WAN [ E2"],
  Mulesoft: ["MuleSoft [ E1", "MuleSoft [ E2", "MuleSoft [ E3"],
  PLM: ["(PLM) [ E1", "(PLM) [ E2", "(PLM) [ E3", "(PLM) [ E4"],
  PeopleSoft: ["Oracle PeopleSoft Core HR [ E1", "Oracle PeopleSoft Core HR [ E2", "Oracle PeopleSoft Core HR [ E3"],
  "Product Management": ["Product Management [ E1", "Product Management [ E2", "Product Management [ E3"],
  "Program Management": ["Program Management [ E1", "Program Management [ E2", "Program Management [ E3"],
  "Solution Architect": ["Solution and Functional Architect (SAFA) [ E1", "Solution and Functional Architect (SAFA) [ E2", "Solution and Functional Architect (SAFA) [ E3", "Solution and Functional Architect (SAFA) [ E4"],
  "Business Analyst": ["Business Analysis [ E1", "Business Analysis [ E2", "Business Analysis [ E3"],
  Cybersecurity: ["Cyber Security [ E1", "Cyber Security [ E2", "Cyber Security - Phishing [ E1", "Cyber Security - Phishing [ E2", "Cyber Security - GRC -  Data Security [ E1", "Cyber Security - GRC -  Data Security [ E2"],
  "Oracle HCM": ["Oracle JDE EnterpriseOne Human Capital Management [ E1", "Oracle JDE EnterpriseOne Human Capital Management [ E2", "Oracle JDE EnterpriseOne Human Capital Management [ E3"],
  "Powe BI": ["Microsoft Power BI [ E1", "Microsoft Power BI [ E2", "Microsoft Power BI [ E3"],
  MiddleWare: ["IT IS_AMS_MiddleWare_WAS [ E1", "IT IS_AMS_MiddleWare_WAS [ E2", "IT IS_AMS_MiddleWare_WAS [ E3"],
  "Performance Testing": ["Performance Testing [ E1", "Performance Testing [ E2", "Performance Testing [ E3"],
  Mainframe: ["COBOL [ E1", "COBOL [ E2", "COBOL [ E3", "Mainframe DB2 - Application Development [ E1", "Mainframe DB2 - Application Development [ E2", "IT IS_AMS_Mainframe_DB2 Administration [ E1", "IT IS_AMS_Mainframe_DB2 Administration [ E2"],
  Apigee: ["APIGEE [ E1", "APIGEE [ E2", "APIGEE [ E3"],
  "SQL Developer": ["MySQL [ E1", "MySQL [ E2", "MySQL [ E3", "ORACLE SQL [ E1", "ORACLE SQL [ E2", "ORACLE SQL [ E3"],
  "SCCM Engineer": ["EUCS_TOOLS_SCCM [ E1", "EUCS_TOOLS_SCCM [ E2", "EUCS_TOOLS_SCCM [ E3"],
  "Data Modeller": ["Data Warehouse [ E1", "Data Warehouse [ E2", "Data Warehouse [ E3", "Data Concepts &amp; Data Modelling [ E1", "Data Concepts &amp; Data Modelling [ E2", "Data Concepts &amp; Data Modelling [ E3"],
  "Indident Manager": ["Incident Management [ E1", "Incident Management [ E2", "Incident Management [ E3"],
  "Change Management": ["Change Management [ L1", "Change Management [ L2", "Change Management [ L3"],
  "Data stage": ["IBM InfoSphere DataStage [ E1", "IBM InfoSphere DataStage [ E2", "IBM InfoSphere DataStage [ E2"],
  "SharePoint Admin": ["SharePoint 2016 [ E1", "SharePoint 2016 [ E2", "SharePoint 2016 [ E3"],
  "Core Microsoft 365 Administration": ["Office 365 Administration [ E1", "Office 365 Administration [ E2", "Office 365 Administration [ E3", "Office 365 Administration [ E4"],
  "VMO Lead": ["SCM - Vendor Management [ E1", "SCM - Vendor Management [ E2", "SCM - Vendor Management [ E3", "SCM - Vendor Management [ E4"],
  "Software Asset Manager": ["ITAM (IT Asset Management) [ E1", "ITAM (IT Asset Management) [ E2", "ITAM (IT Asset Management) [ E3", "ITAM (IT Asset Management) [ E4"],
  "Sterling OMS": ["IBM Sterling Commerce OMS [ E1", "IBM Sterling Commerce OMS [ E2", "IBM Sterling Commerce OMS [ E3", "IBM Sterling Commerce OMS [ E4"],
  "BY Work Force Management": ["PL/SQL [ E1", "PL/SQL [ E2", "PL/SQL [ E3", "PL/SQL [ E4"],
  "SAP S4 HANA Finance": ["SAP S/4HANA - Central Finance [ E1", "SAP S/4HANA - Central Finance [ E2", "SAP S/4HANA - Central Finance [ E3", "SAP S/4HANA - Central Finance [ E4"],
  "IBM WMQ": ["IBM Websphere MQ Series [ E1", "IBM Websphere MQ Series [ E2", "IBM Websphere MQ Series [ E3", "IBM Websphere MQ Series [ E4", "Azure Service Bus [ E1", "Azure Service Bus [ E2", "Azure Service Bus [ E3"],
  ITAM: ["CMDB Management [ E1", "CMDB Management [ E2", "CMDB Management [ E3", "MDM [ E1", "MDM [ E2", "MDM [ E3"],
  Intune: ["Microsoft Intune [ E1", "Microsoft Intune [ E2", "Microsoft Intune [ E3"],
  "Project Manager": ["Project Management [ E2", "Project Management [ E3", "Project Management [ E4", "Project Management [ E5"],
  "Windows Engineer": ["Windows Servers [ E1", "Windows Servers [ E2", "Windows Servers [ E3", "Windows Servers [ E4"],
  "Salesforce Commerce Cloud": ["Salesforce Commerce Cloud [ E1", "Salesforce Commerce Cloud [ E2", "Salesforce Commerce Cloud [ E3", "Salesforce Commerce Cloud [ E4"],
  "SAP MM": ["SAP ERP Materials Management (MM) [ E1", "SAP ERP Materials Management (MM) [ E2", "SAP ERP Materials Management (MM) [ E3", "SAP ERP Materials Management (MM) [ E4"],
  "SAP FICO": ["SAP ERP Financial Accounting (FI) [ E1", "SAP ERP Financial Accounting (FI) [ E2", "SAP ERP Financial Accounting (FI) [ E3", "SAP ERP Financial Accounting (FI) [ E4", "SAP ERP Controlling (CO) [ E1", "SAP ERP Controlling (CO) [ E2", "SAP ERP Controlling (CO) [ E3", "SAP ERP Controlling (CO) [ E4"],
};

// Build a reverse map: normalized detail-skill-name -> core skill.
function unescapeHtml(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeName(name) {
  return unescapeHtml(name)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripCategoryPrefix(name) {
  const text = unescapeHtml(name).replace(/\u00a0/g, " ");
  const idx = text.indexOf(" : ");
  return (idx !== -1 ? text.slice(idx + 3) : text).replace(/\s+/g, " ").trim();
}

export function buildReverseMap(skillMap) {
  const reverse = new Map();
  for (const [core, details] of Object.entries(skillMap)) {
    for (const entry of details) {
      const detailName = entry.split("[")[0];
      reverse.set(normalizeName(detailName), core);
      reverse.set(normalizeName(stripCategoryPrefix(detailName)), core);
    }
  }
  return reverse;
}

export const REVERSE_MAP = buildReverseMap(SKILL_MAP);

// Look up the core skill for a given detail skill name.
export function mapCoreSkill(skillName) {
  if (!skillName) return "";
  return (
    REVERSE_MAP.get(normalizeName(skillName)) ||
    REVERSE_MAP.get(normalizeName(stripCategoryPrefix(skillName))) ||
    ""
  );
}

// Return all core skill category names.
export function getCoreSkillCategories() {
  return Object.keys(SKILL_MAP);
}
