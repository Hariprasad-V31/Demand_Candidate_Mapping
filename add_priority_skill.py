"""
Add "Highest Priority Detailed Skillset" and "Mapped Core Skill" columns.

For each candidate row, the script scans the [Primary] and [Secondary] skill
strings, where each skill is formatted as:  Skill Name [ Ex Y Yrs ]
(e.g. "Business Analysis [ E2 2 Yrs ]").

Priority logic
--------------
* The numeric value after the level letter is the expertise level
  (E3 > E2 > E1 > E0).
* The single skill with the highest level across BOTH columns is selected.
* Tie-breaker: if the highest level is shared between a Primary and a
  Secondary skill, the Primary skill wins.

Two new columns are inserted immediately AFTER the Secondary column:
  1. Highest Priority Detailed Skillset -> the winning skill name
  2. Mapped Core Skill                  -> its mapped core skill

Usage:
    python add_priority_skill.py [input.xlsx] [output.xlsx]

Defaults:
    input  = input.xlsx
    output = output.xlsx
"""

import html
import re
import sys

import pandas as pd

PRIMARY_COL = "Primary"
SECONDARY_COL = "Secondary"
OUT_SKILL_COL = "Highest Priority Detailed Skillset"
OUT_CORE_COL = "Mapped Core Skill"

# Detail-skill -> Core-skill mapping. The lists hold detail-skill prefixes
# (skill name + level). Only the skill name part is used for lookup.
SKILL_MAP = {
    'Java': ['Core Java [ E1', 'Core Java [ E2', 'Core Java [ E3', 'Core Java [ E4', 'Advanced Java Concepts [ E1', 'Advanced Java Concepts [ E2', 'Advanced Java Concepts [ E3', 'Java - JDBC [ E1', 'Java - JDBC [ E2', 'Java - JDBC [ E3', 'Java Architecture [ E1', 'Java Architecture [ E2', 'Java Architecture [ E3', 'Java API Management &amp; Microservices [ E1', 'Java API Management &amp; Microservices [ E2', 'Java API Management &amp; Microservices [ E2'],
    'ReactJS': ['Digital : ReactJS [ E1', 'Digital : ReactJS [ E2', 'Digital : ReactJS [ E3', 'Digital : ReactJS [ E1', 'Digital : ReactJS [ E2', 'Digital : ReactJS [ E3'],
    'Spring Boot': ['Spring Boot [ E1', 'Spring Boot [ E2', 'Spring Boot [ E3'],
    'Microservices': ['Microservices [ E1', 'Microservices [ E2', 'Microservices [ E3'],
    'Databricks': ['Databricks [ E1', 'Databricks [ E2', 'Databricks [ E3', 'PySpark [ E1', 'PySpark [ E2', 'PySpark [ E3'],
    'Data Engineering': ['Google Data Engineering [ E1', 'Google Data Engineering [ E2', 'Google Data Engineering [ E3'],
    'Python': ['Python [ E1', 'Python [ E1', 'Python [ E2', 'Python [ E2', 'Python [ E3', 'Python [ E3', 'Python [ E4'],
    'Angular': ['AngularJS [ E1', 'AngularJS [ E1', 'Angular 2 [ E1', 'Angular 2 [ E2', 'Angular4 [ E1', 'Angular5 [ E1', 'Angular 8 [ E1', 'Angular 9 [ E1', 'Angular 9 [ E2', 'Angular 9 [ E3', 'Angular 9 [ E4', 'Angular 7 [ E1', 'Angular 7 [ E2', 'Angular 7 [ E3'],
    'DevOps': ['DevOps [ E1', 'DevOps [ E1', 'DevOps [ E2', 'DevOps [ E3', 'Terraform [ E0', 'Terraform [ E1', 'Terraform [ E2', 'Cloud DevOps [ E1', 'Cloud DevOps [ E2', 'Cloud DevOps [ E3'],
    'Database Engineer (Oracle)': ['ORACLE SQL [ E1', 'ORACLE SQL [ E2', 'ORACLE SQL [ E3', 'Oracle DBA [ E1', 'Oracle DBA [ E2', 'Oracle DBA [ E3', 'Oracle DBA [ E4', 'Oracle Database 12C Administration [ E1', 'Oracle Database 12C Administration [ E2', 'Oracle Database 12C Administration [ E3', 'Oracle Database Administration [ E1', 'Oracle Database Administration [ E2', 'Oracle Database Administration [ E3'],
    'Linux': ['Unix / Linux Basics and Commands [ E1', 'Unix / Linux Basics and Commands [ E2', 'Unix / Linux Basics and Commands [ E3', 'RedHat Linux [ E1', 'RedHat Linux [ E2', 'RedHat Linux [ E3'],
    'Automation tesing': ['Selenium [ E1', 'Selenium [ E2', 'Selenium [ E3', 'Test Automation [ E1', 'Test Automation [ E2', 'Test Automation [ E3', 'Test Automation [ E4', 'TOSCA [ E1', 'TOSCA [ E2', 'TOSCA [ E3'],
    'Manual Testing': ['Testing Concepts, Process and Methodology [ E1', 'Testing Concepts, Process and Methodology [ E2', 'Testing Concepts, Process and Methodology [ E3', 'Manual Testing Processes and Management [ E1', 'Manual Testing Processes and Management [ E2', 'Manual Testing Processes and Management [ E3', 'Functional Testing [ E1', 'Functional Testing [ E2', 'Functional Testing [ E3'],
    'SAP ABAP': ['SAP Advanced Business Application Programming (ABAP) for non-HANA [ E1', 'SAP Advanced Business Application Programming (ABAP) for non-HANA [ E2', 'SAP Advanced Business Application Programming (ABAP) for non-HANA [ E3'],
    'SAP BASIS': ['SAP BASIS - HANA [ E1', 'SAP BASIS - HANA [ E2', 'SAP BASIS - HANA [ E3'],
    'RPA': ['Robotic Process Automation - UiPath [ E1', 'Robotic Process Automation - UiPath [ E2', 'Robotic Process Automation - UiPath [ E3', 'Robotic Process Automation - BluePrism [ E1', 'Robotic Process Automation - BluePrism [ E2', 'Robotic Process Automation - BluePrism [ E3'],
    'STIBO': ['STIBO Master Data Management [ E1', 'STIBO Master Data Management [ E2', 'STIBO Master Data Management [ E3'],
    'VMWare': ['VMWare [ E1', 'VMWare [ E2', 'VMWare [ E3', 'VMware vSphere [ E1', 'VMware vSphere [ E2', 'VMware vSphere [ E3'],
    'Network engineer': ['IT IS_CNS_Wireless Network_Cisco [ E1', 'IT IS_CNS_Wireless Network_Cisco [ E2', 'IT IS_CNS_Wireless Network_Cisco [ E3', 'Network Switching(LAN Technology) [ E1', 'Network Switching(LAN Technology) [ E2', 'Network Switching(LAN Technology) [ E3', 'Network Security [ E1', 'Network Security [ E2', 'EIS : Network Engineer [ E1', 'EIS : Network Engineer [ E2', 'FortiGate SD-WAN [ E1', 'FortiGate SD-WAN [ E2'],
    'Mulesoft': ['MuleSoft [ E1', 'MuleSoft [ E2', 'MuleSoft [ E3'],
    'PLM': ['(PLM) [ E1', '(PLM) [ E2', '(PLM) [ E3', '(PLM) [ E4'],
    'PeopleSoft': ['Oracle PeopleSoft Core HR [ E1', 'Oracle PeopleSoft Core HR [ E2', 'Oracle PeopleSoft Core HR [ E3'],
    'Product Management': ['Product Management [ E1', 'Product Management [ E2', 'Product Management [ E3'],
    'Program Management': ['Program Management [ E1', 'Program Management [ E2', 'Program Management [ E3'],
    'Solution Architect': ['Solution and Functional Architect (SAFA) [ E1', 'Solution and Functional Architect (SAFA) [ E2', 'Solution and Functional Architect (SAFA) [ E3', 'Solution and Functional Architect (SAFA) [ E4'],
    'Business Analyst': ['Business Analysis [ E1', 'Business Analysis [ E2', 'Business Analysis [ E3'],
    'Cybersecurity': ['Cyber Security [ E1', 'Cyber Security [ E2', 'Cyber Security - Phishing [ E1', 'Cyber Security - Phishing [ E2', 'Cyber Security - GRC -  Data Security [ E1', 'Cyber Security - GRC -  Data Security [ E2'],
    'Oracle HCM': ['Oracle JDE EnterpriseOne Human Capital Management [ E1', 'Oracle JDE EnterpriseOne Human Capital Management [ E2', 'Oracle JDE EnterpriseOne Human Capital Management [ E3'],
    'Powe BI': ['Microsoft Power BI [ E1', 'Microsoft Power BI [ E2', 'Microsoft Power BI [ E3'],
    'MiddleWare': ['IT IS_AMS_MiddleWare_WAS [ E1', 'IT IS_AMS_MiddleWare_WAS [ E2', 'IT IS_AMS_MiddleWare_WAS [ E3'],
    'Performance Testing': ['Performance Testing [ E1', 'Performance Testing [ E2', 'Performance Testing [ E3'],
    'Mainframe': ['COBOL [ E1', 'COBOL [ E2', 'COBOL [ E3', 'Mainframe DB2 - Application Development [ E1', 'Mainframe DB2 - Application Development [ E2', 'IT IS_AMS_Mainframe_DB2 Administration [ E1', 'IT IS_AMS_Mainframe_DB2 Administration [ E2'],
    'Apigee': ['APIGEE [ E1', 'APIGEE [ E2', 'APIGEE [ E3'],
    'SQL Developer': ['MySQL [ E1', 'MySQL [ E2', 'MySQL [ E3', 'ORACLE SQL [ E1', 'ORACLE SQL [ E2', 'ORACLE SQL [ E3'],
    'SCCM Engineer': ['EUCS_TOOLS_SCCM [ E1', 'EUCS_TOOLS_SCCM [ E2', 'EUCS_TOOLS_SCCM [ E3'],
    'Data Modeller': ['Data Warehouse [ E1', 'Data Warehouse [ E2', 'Data Warehouse [ E3', 'Data Concepts &amp; Data Modelling [ E1', 'Data Concepts &amp; Data Modelling [ E2', 'Data Concepts &amp; Data Modelling [ E3'],
    'Indident Manager': ['Incident Management [ E1', 'Incident Management [ E2', 'Incident Management [ E3'],
    'Change Management': ['Change Management [ L1', 'Change Management [ L2', 'Change Management [ L3'],
    'Data stage': ['IBM InfoSphere DataStage [ E1', 'IBM InfoSphere DataStage [ E2', 'IBM InfoSphere DataStage [ E2'],
    'SharePoint Admin': ['SharePoint 2016 [ E1', 'SharePoint 2016 [ E2', 'SharePoint 2016 [ E3'],
    'Core Microsoft 365 Administration': ['Office 365 Administration [ E1', 'Office 365 Administration [ E2', 'Office 365 Administration [ E3', 'Office 365 Administration [ E4'],
    'VMO Lead': ['SCM - Vendor Management [ E1', 'SCM - Vendor Management [ E2', 'SCM - Vendor Management [ E3', 'SCM - Vendor Management [ E4'],
    'Software Asset Manager': ['ITAM (IT Asset Management) [ E1', 'ITAM (IT Asset Management) [ E2', 'ITAM (IT Asset Management) [ E3', 'ITAM (IT Asset Management) [ E4'],
    'Sterling OMS': ['IBM Sterling Commerce OMS [ E1', 'IBM Sterling Commerce OMS [ E2', 'IBM Sterling Commerce OMS [ E3', 'IBM Sterling Commerce OMS [ E4'],
    'BY Work Force Management': ['PL/SQL [ E1', 'PL/SQL [ E2', 'PL/SQL [ E3', 'PL/SQL [ E4'],
    'SAP S4 HANA Finance': ['SAP S/4HANA - Central Finance [ E1', 'SAP S/4HANA - Central Finance [ E2', 'SAP S/4HANA - Central Finance [ E3', 'SAP S/4HANA - Central Finance [ E4'],
    'IBM WMQ': ['IBM Websphere MQ Series [ E1', 'IBM Websphere MQ Series [ E2', 'IBM Websphere MQ Series [ E3', 'IBM Websphere MQ Series [ E4', 'Azure Service Bus [ E1', 'Azure Service Bus [ E2', 'Azure Service Bus [ E3'],
    'ITAM': ['CMDB Management [ E1', 'CMDB Management [ E2', 'CMDB Management [ E3', 'MDM [ E1', 'MDM [ E2', 'MDM [ E3'],
    'Intune': ['Microsoft Intune [ E1', 'Microsoft Intune [ E2', 'Microsoft Intune [ E3'],
}

# Captures the level letter+number inside the first bracket, e.g. "[ E2 2 Yrs ]".
LEVEL_PATTERN = re.compile(r"\[\s*[A-Za-z]+\s*(\d+)")


def normalize_name(name):
    """Normalize a skill name for reliable lookups."""
    name = html.unescape(str(name))          # "&amp;" -> "&"
    name = name.replace("\u00a0", " ")        # non-breaking spaces
    name = re.sub(r"\s+", " ", name)          # collapse whitespace
    return name.strip().lower()


def build_reverse_map(skill_map):
    """detail-skill-name (normalized) -> core skill."""
    reverse = {}
    for core, details in skill_map.items():
        for entry in details:
            detail_name = entry.split("[", 1)[0]
            reverse[normalize_name(detail_name)] = core
    return reverse


REVERSE_MAP = build_reverse_map(SKILL_MAP)


def parse_skills(cell):
    """Yield (skill_name, level) tuples for each skill in a cell."""
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return
    for segment in str(cell).split(";"):
        segment = segment.strip()
        if not segment:
            continue
        match = LEVEL_PATTERN.search(segment)
        if not match:
            continue
        skill_name = segment.split("[", 1)[0].strip()
        if skill_name:
            yield skill_name, int(match.group(1))


def highest_priority_skill(primary_cell, secondary_cell):
    """Return the skill name with the highest level (Primary wins ties)."""
    best_name = ""
    best_level = -1
    # Primary processed first so it wins on equal levels.
    for cell in (primary_cell, secondary_cell):
        for skill_name, level in parse_skills(cell):
            if level > best_level:
                best_level = level
                best_name = skill_name
    return best_name


def map_core_skill(skill_name):
    if not skill_name:
        return ""
    return REVERSE_MAP.get(normalize_name(skill_name), "")


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "input.xlsx"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "output.xlsx"

    df = pd.read_excel(input_path)

    for col in (PRIMARY_COL, SECONDARY_COL):
        if col not in df.columns:
            raise SystemExit(f"Error: required column '{col}' not found in {input_path}.")

    top_skills = []
    core_skills = []
    for _, row in df.iterrows():
        skill = highest_priority_skill(row[PRIMARY_COL], row[SECONDARY_COL])
        top_skills.append(skill)
        core_skills.append(map_core_skill(skill))

    # Insert the two new columns immediately after the Secondary column.
    insert_at = df.columns.get_loc(SECONDARY_COL) + 1
    df.insert(insert_at, OUT_SKILL_COL, top_skills)
    df.insert(insert_at + 1, OUT_CORE_COL, core_skills)

    df.to_excel(output_path, index=False)
    print(f"Done. Output written to '{output_path}'.")


if __name__ == "__main__":
    main()
