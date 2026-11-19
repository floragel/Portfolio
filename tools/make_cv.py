"""
Builds assets/cv/cv-nayl-lahlou-fr.pdf and -en.pdf from the content below (one A4 page each).
Run:  python3 tools/make_cv.py
Needs Google Chrome installed (headless print to PDF). Fill EMAIL / SITE when known.
"""
import html, pathlib, subprocess, tempfile

EMAIL = "lahlou@nayl.ca"
SITE = "https://nayl.ca"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "cv"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

C = {
  "fr": {
    "title": "Développeur logiciel et matériel",
    "loc": "Montréal, QC",
    "summary": "Je crée des apps et des robots depuis mes 9 ans. Projet phare : Clofit, une app iPhone de styliste IA. Deux podiums à HackDécouverte (Université Concordia), constructeur de robot dans l'équipe FRC 6622 et boursier SHAD 2026.",
    "h": {"projects": "Projets", "awards": "Prix et distinctions", "lead": "Leadership et prise de parole", "edu": "Formation", "skills": "Compétences", "lang": "Langues"},
    "projects": [
      ("Clofit", "App iOS, 2025 – 2026", "Garde-robe numérique et styliste IA : tenues générées par IA à partir des vrais vêtements, selon la météo. SwiftUI, vision par ordinateur, LLM. clofit.app"),
      ("Lync", "2e place, HackDécouverte 2, 2026", "App de campus Android et iOS : réseau social étudiant et navigation intérieure de porte à porte (7 étages cartographiés, 761 points, 120 tests). Kotlin, Swift, Supabase."),
      ("Trakant", "1re place, HackDécouverte 1, 2025", "Application conçue et livrée en équipe pendant le hackathon. Kotlin."),
      ("Floragel (JA Québec)", "VP IT, 2024 – 2025", "Architecture informatique et plateforme web de l'entreprise. Classé 2e meilleur VP IT au Québec, prix du meilleur pitch."),
      ("Robotique FRC 6622, StanRobotix", "2024 – aujourd'hui", "Assemblage, câblage et stratégie du robot de compétition. Mini robot du gala en C++ / WPILib (conduite, accélération douce, LEDs)."),
      ("Jarvis OS et pont IoT", "2025 – 2026", "Assistant vocal en Python avec synthèse vocale locale, relié à un pont matériel ESP32 / Arduino pour piloter la maison."),
      ("Casque VR autonome", "2022", "Construit de zéro à 12 ans : Raspberry Pi 4, Arduino Leonardo, suivi de mouvement 9 axes."),
    ],
    "awards": [
      "Boursier SHAD 2026 Community Changemaker (Fondation McCall MacBain), Western University",
      "Lauréat du Défi OSEntreprendre 2025",
      "Prix Rhétorique et Humanités 2026, Collège Stanislas",
      "Prix du Mérite et Réussite scolaire 2025, Collège Stanislas",
      "Camp d'informatique McGill 2026 (sélectionné), ConUHacks 2026",
    ],
    "lead": [
      "Maître de cérémonie du gala de reconnaissance du Collège Stanislas (800 invités), 2026",
      "Maître de cérémonie des 10 ans de StanRobotix, 2026",
      "Président de comité, COP Sécurité alimentaire 2027 (simulation ONU)",
      "Délégué : DESMNU 2026 (Chine, Conseil de sécurité), COP Océan 2025 (Royaume-Uni), MASSMUN 2023",
    ],
    "edu": [("Collège Stanislas, Montréal", "2024 – aujourd'hui"), ("Lycée Claudel, Ottawa", "2023 – 2024"), ("Lycée Louis Massignon, Casablanca", "2016 – 2023")],
    "skills": [("Logiciel et IA", "SwiftUI, Kotlin, Python, TypeScript, React Native, LLM, vision par ordinateur"), ("Web et données", "Next.js, React, Node.js, PHP, PostgreSQL, Git"), ("Matériel", "Arduino, ESP32, Raspberry Pi, C++, capteurs, robotique FRC, Blender")],
    "lang": "Français (langue maternelle), anglais (courant)",
  },
  "en": {
    "title": "Software & hardware developer",
    "loc": "Montreal, QC",
    "summary": "I have been building apps and robots since I was 9. Flagship project: Clofit, an AI stylist iPhone app. Two podiums at HackDécouverte (Concordia University), robot builder on FRC team 6622 and SHAD 2026 scholar.",
    "h": {"projects": "Projects", "awards": "Awards", "lead": "Leadership & public speaking", "edu": "Education", "skills": "Skills", "lang": "Languages"},
    "projects": [
      ("Clofit", "iOS app, 2025 – 2026", "Digital wardrobe and AI stylist: AI-made outfits from the clothes you own, matched to the weather. SwiftUI, computer vision, LLMs. clofit.app"),
      ("Lync", "2nd place, HackDécouverte 2, 2026", "Android and iOS campus app: student social network plus door-to-door indoor navigation (7 floors mapped, 761 nodes, 120 tests). Kotlin, Swift, Supabase."),
      ("Trakant", "1st place, HackDécouverte 1, 2025", "App designed and shipped as a team during the hackathon. Kotlin."),
      ("Floragel (JA Québec)", "VP IT, 2024 – 2025", "IT architecture and web platform for the company. Ranked 2nd best VP IT in Quebec, Best Sales Pitch award."),
      ("FRC Robotics 6622, StanRobotix", "2024 – present", "Assembly, wiring and strategy for the competition robot. Gala mini robot in C++ / WPILib (drive, smooth acceleration, LEDs)."),
      ("Jarvis OS & IoT bridge", "2025 – 2026", "Python voice assistant with local text-to-speech, linked to an ESP32 / Arduino hardware bridge for home control."),
      ("Standalone VR headset", "2022", "Built from scratch at 12: Raspberry Pi 4, Arduino Leonardo, 9-axis motion tracking."),
    ],
    "awards": [
      "SHAD 2026 Community Changemaker Scholar (McCall MacBain Foundation), Western University",
      "Winner, Défi OSEntreprendre 2025",
      "Rhetoric & Humanities Award 2026, Collège Stanislas",
      "Merit Award and Academic Achievement 2025, Collège Stanislas",
      "McGill Computer Science Camp 2026 (selected), ConUHacks 2026",
    ],
    "lead": [
      "Master of ceremonies, Collège Stanislas recognition gala (800 guests), 2026",
      "Master of ceremonies, StanRobotix 10th anniversary, 2026",
      "Committee president, COP Food Security 2027 (Model UN)",
      "Delegate: DESMNU 2026 (China, Security Council), COP Ocean 2025 (UK), MASSMUN 2023",
    ],
    "edu": [("Collège Stanislas, Montreal", "2024 – present"), ("Lycée Claudel, Ottawa", "2023 – 2024"), ("Lycée Louis Massignon, Casablanca", "2016 – 2023")],
    "skills": [("Software & AI", "SwiftUI, Kotlin, Python, TypeScript, React Native, LLMs, computer vision"), ("Web & data", "Next.js, React, Node.js, PHP, PostgreSQL, Git"), ("Hardware", "Arduino, ESP32, Raspberry Pi, C++, sensors, FRC robotics, Blender")],
    "lang": "French (native), English (fluent)",
  },
}

CSS = """
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font: 9.6pt/1.42 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #17181A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; padding: 15mm 15mm 12mm; display: grid; grid-template-columns: 1fr 58mm; gap: 9mm; align-content: start; }
header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.4pt solid #17181A; padding-bottom: 4mm; }
h1 { font: 700 25pt/1 'Inter Tight', 'Inter', sans-serif; letter-spacing: -.03em; }
.role { margin-top: 2mm; font-size: 11pt; color: #55585C; }
.links { text-align: right; font-size: 8.6pt; line-height: 1.6; color: #33363A; }
.summary { grid-column: 1 / -1; font-size: 10pt; color: #33363A; margin-top: -3mm; }
h2 { font: 600 8.4pt 'Inter', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #8B6A2F; margin: 0 0 2.2mm; }
section + section { margin-top: 5mm; }
.p { margin-bottom: 2.6mm; break-inside: avoid; }
.p .t { display: flex; justify-content: space-between; gap: 4mm; }
.p b { font-weight: 600; font-size: 10pt; }
.p .m { color: #6E7073; font-size: 8.4pt; white-space: nowrap; }
.p .d { color: #33363A; }
ul { list-style: none; }
li { position: relative; padding-left: 3.2mm; margin-bottom: 1.6mm; color: #33363A; }
li::before { content: ""; position: absolute; left: 0; top: 1.9mm; width: 1.3mm; height: 1.3mm; border-radius: 50%; background: #C9A25E; }
.side .row { margin-bottom: 2mm; }
.side .row b { display: block; font-weight: 600; }
.side .row span { color: #55585C; font-size: 8.6pt; }
"""

def build(lang):
    d = C[lang]; e = html.escape
    links = ["github.com/floragel", "linkedin.com/in/nayl-lahlou", d["loc"]]
    if EMAIL: links.insert(0, EMAIL)
    if SITE: links.insert(1 if EMAIL else 0, SITE.replace("https://", ""))
    proj = "".join(f'<div class="p"><div class="t"><b>{e(n)}</b><span class="m">{e(m)}</span></div><div class="d">{e(x)}</div></div>' for n, m, x in d["projects"])
    lis = lambda xs: "".join(f"<li>{e(x)}</li>" for x in xs)
    edu = "".join(f'<div class="row"><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in d["edu"])
    sk = "".join(f'<div class="row"><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in d["skills"])
    h = d["h"]
    return f"""<!DOCTYPE html><html lang="{lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body><div class="page">
<header><div><h1>Nayl Lahlou</h1><div class="role">{e(d['title'])}</div></div><div class="links">{'<br>'.join(e(l) for l in links)}</div></header>
<p class="summary">{e(d['summary'])}</p>
<main><section><h2>{h['projects']}</h2>{proj}</section><section><h2>{h['lead']}</h2><ul>{lis(d['lead'])}</ul></section></main>
<aside class="side"><section><h2>{h['awards']}</h2><ul>{lis(d['awards'])}</ul></section>
<section><h2>{h['edu']}</h2>{edu}</section><section><h2>{h['skills']}</h2>{sk}</section>
<section><h2>{h['lang']}</h2><div class="row"><span>{e(d['lang'])}</span></div></section></aside>
</div></body></html>"""

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for lang in ("fr", "en"):
            src = pathlib.Path(tmp) / f"cv-{lang}.html"; src.write_text(build(lang), encoding="utf-8")
            pdf = OUT / f"cv-nayl-lahlou-{lang}.pdf"
            subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={tmp}/prof", "--no-pdf-header-footer",
                            "--virtual-time-budget=6000", f"--print-to-pdf={pdf}", src.as_uri()], check=True, capture_output=True)
            print("wrote", pdf.relative_to(ROOT), pdf.stat().st_size // 1024, "KB")

if __name__ == "__main__":
    main()
