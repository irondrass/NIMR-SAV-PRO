import { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

class DefectReporter implements Reporter {
  private reportPath = path.resolve(process.cwd(), "qa-report.md");

  onBegin() {
    // Initialize or clear the report file at start of run
    const header = `# Rapport de Défauts Automatiques QA - NIMR SAV PRO v1.1.0

Ce rapport répertorie tous les défauts fonctionnels et techniques détectés lors des tests d'intégration E2E.

| Date / Heure | Scénario / Test | Rôle | Gravité | Statut | Détails |
| :--- | :--- | :--- | :--- | :--- | :--- |
`;
    // Only write header if the file does not exist or if we want to reset it per full run
    fs.writeFileSync(this.reportPath, header, "utf8");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "passed" || result.status === "skipped") {
      return;
    }

    const now = new Date().toLocaleString("fr-FR");
    const testTitle = test.title;
    const parentFile = path.basename(test.location.file);
    
    // Guess role and severity from test name or file name
    let role = "Inconnu";
    if (parentFile.includes("directeur")) role = "Directeur SAV";
    else if (parentFile.includes("receptionnaire")) role = "Réceptionnaire";
    else if (parentFile.includes("chef-atelier")) role = "Chef d’atelier";
    else if (parentFile.includes("technicien")) role = "Technicien";
    else if (parentFile.includes("controle-qualite")) role = "Contrôle Qualité";
    else if (parentFile.includes("livraison")) role = "Livraison";
    else if (parentFile.includes("lecture-seule")) role = "Lecture seule";

    let severity = "mineur";
    const titleLower = testTitle.toLowerCase();
    const fileLower = parentFile.toLowerCase();
    if (titleLower.includes("verrouillage") || titleLower.includes("interdit") || titleLower.includes("bloque") || fileLower.includes("smoke")) {
      severity = "bloquant";
    } else if (titleLower.includes("erreur") || titleLower.includes("crash") || titleLower.includes("persistence")) {
      severity = "majeur";
    }

    // Capture attachments
    const screenshot = result.attachments.find(a => a.name === "screenshot")?.path || "";
    const trace = result.attachments.find(a => a.name === "trace")?.path || "";
    const video = result.attachments.find(a => a.name === "video")?.path || "";

    const cleanError = result.error?.message
      ? result.error.message.replace(/[\r\n]+/g, " ").slice(0, 150) + "..."
      : "Erreur inconnue";

    // Format table row
    const row = `| ${now} | **${testTitle}** (${parentFile}) | ${role} | **${severity.toUpperCase()}** | ÉCHEC | ${cleanError} |\n`;
    fs.appendFileSync(this.reportPath, row, "utf8");

    // Also write a detailed section at the bottom for developers
    const detailSection = `
## Détail Échec : ${testTitle}
* **Fichier :** \`${parentFile}\`
* **Gravité :** \`${severity.toUpperCase()}\`
* **Message d'erreur :** 
\`\`\`
${result.error?.stack || result.error?.message || "Pas de stack trace"}
\`\`\`
${screenshot ? `* **Capture d'écran :** [Voir capture](${path.relative(process.cwd(), screenshot)})` : ""}
${trace ? `* **Trace Playwright :** [Télécharger la trace](${path.relative(process.cwd(), trace)})` : ""}
${video ? `* **Vidéo :** [Voir la vidéo](${path.relative(process.cwd(), video)})` : ""}

---
`;
    fs.appendFileSync(this.reportPath, detailSection, "utf8");
  }
}

export default DefectReporter;
