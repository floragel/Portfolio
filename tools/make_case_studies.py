"""Generates projets/lync.html, projets/clofit.html, projets/mini-robot.html (bilingual FR/EN).
Run: python3 tools/make_case_studies.py
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "projets"

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | Nayl Lahlou</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#0E0F11">
  <meta property="og:title" content="{title} | Nayl Lahlou">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{og}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23F2F1EE'/%3E%3Crect x='10' y='10' width='12' height='12' rx='2' fill='%230E0F11'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600;700&family=Fragment+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="case.css">
  <script>try {{ var l = localStorage.getItem('language'); document.documentElement.lang = l === 'fr' ? 'fr' : (l === 'en' ? 'en' : ((navigator.language || 'en').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en')); }} catch (e) {{}}</script>
</head>
<body style="--c: {color}">
<header class="top"><div class="wrap">
  <a class="back" href="../index.html#projects"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg><span data-lang="fr">Portfolio de Nayl</span><span data-lang="en">Nayl's portfolio</span></a>
  <div class="lang"><button data-set="en">EN</button><button data-set="fr">FR</button></div>
</div></header>
<main class="wrap">
"""

FOOT = """
  <div class="next">
    <div><small><span data-lang="fr">Étude de cas suivante</span><span data-lang="en">Next case study</span></small><a class="big" href="{next_href}">{next_title}</a></div>
    <a class="pill ghost" href="../index.html#contact"><span data-lang="fr">Me contacter</span><span data-lang="en">Get in touch</span></a>
  </div>
</main>
<footer class="wrap">© 2026 Nayl Lahlou</footer>
<script>
  (function () {
    function sync() { document.querySelectorAll('.lang button').forEach(function (b) { b.classList.toggle('on', b.dataset.set === document.documentElement.lang); }); }
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.addEventListener('click', function () { document.documentElement.lang = b.dataset.set; try { localStorage.setItem('language', b.dataset.set); } catch (e) {} sync(); });
    });
    sync();
  })();
</script>
</body>
</html>
"""

def foot(href, title):
    return FOOT.replace('{next_href}', href).replace('{next_title}', title)

def fr_en(fr, en, tag="span"):
    return f'<{tag} data-lang="fr">{fr}</{tag}><{tag} data-lang="en">{en}</{tag}>'

def block(num_fr, num_en, h_fr, h_en, body):
    return f"""
  <section class="block narrow">
    <span class="num">{fr_en(num_fr, num_en)}</span>
    <h2>{fr_en(h_fr, h_en)}</h2>
    {body}
  </section>"""

def p(fr, en):
    return f'<p data-lang="fr">{fr}</p><p data-lang="en">{en}</p>'

def points(items):
    fr = "".join(f"<li>{a}</li>" for a, _ in items); en = "".join(f"<li>{b}</li>" for _, b in items)
    return f'<ul class="points" data-lang="fr">{fr}</ul><ul class="points" data-lang="en">{en}</ul>'

def cards(items):
    out = []
    for tag_fr, tag_en, t_fr, t_en, d_fr, d_en in items:
        out.append(f'<div class="card"><span class="tag">{fr_en(tag_fr, tag_en)}</span><h3>{fr_en(t_fr, t_en)}</h3><p data-lang="fr">{d_fr}</p><p data-lang="en">{d_en}</p></div>')
    return f'<div class="cards">{"".join(out)}</div>'

def facts(items):
    return '<dl class="facts">' + "".join(f"<div><dt>{fr_en(a, b)}</dt><dd>{fr_en(c, d)}</dd></div>" for a, b, c, d in items) + "</dl>"

# ---------------------------------------------------------------- LYNC
lync = HEAD.format(title="Lync", desc="Case study: Lync, a campus app with door-to-door indoor navigation. 2nd place at HackDécouverte 2.", og="../assets/img/lync/team-2.jpg", color="var(--sw)") + f"""
  <section class="hero">
    <span class="kicker">{fr_en('Étude de cas, logiciel', 'Case study, software')}</span>
    <h1>Lync</h1>
    <p class="lede" data-lang="fr">Trouver sa salle sur un campus qu'on ne connaît pas, sans GPS à l'intérieur. Une app conçue et construite en équipe pendant HackDécouverte 2, à l'Université Concordia.</p>
    <p class="lede" data-lang="en">Finding your room on a campus you don't know, with no GPS indoors. An app designed and built as a team during HackDécouverte 2 at Concordia University.</p>
    {facts([('Résultat', 'Result', '2e place, HackDécouverte 2', '2nd place, HackDécouverte 2'), ('Plateformes', 'Platforms', 'Android et iOS', 'Android and iOS'), ('Bâtiment cartographié', 'Building mapped', 'John Molson, 7 étages', 'John Molson, 7 floors'), ('Fiabilité', 'Reliability', '120 tests unitaires', '120 unit tests')])}
    <div class="actions"><a class="pill light" href="https://github.com/floragel/HackDecouverte2" target="_blank" rel="noopener">{fr_en('Voir le code sur GitHub', 'View the code on GitHub')}</a></div>
  </section>
  <figure class="media" style="max-width:420px"><video src="../assets/img/lync/demo.mp4" controls playsinline preload="metadata"></video></figure>
  <figcaption>{fr_en('Démo de l’app (46 s).', 'App demo (46 s).')}</figcaption>
""" + block("01", "01", "Le problème", "The problem", p(
    "Le GPS s'arrête à la porte des bâtiments. Pour un nouvel étudiant, une salle comme <strong>MB-2.255</strong> ne veut rien dire : quel bâtiment, quel étage, quel couloir ? On voulait une app qui guide <strong>de la rue jusqu'à la porte de la salle</strong>, et qui serve aussi à rencontrer les gens de son campus.",
    "GPS stops at the building door. For a new student, a room like <strong>MB-2.255</strong> means nothing: which building, which floor, which hallway? We wanted an app that guides you <strong>from the street to the classroom door</strong>, and that also helps you meet people on your campus.")) + block("02", "02", "Ce qu'on a construit", "What we built", points([
    ("<strong>Réseau</strong> : un réseau social réservé au campus avec fil, stories, camarades, clubs, événements et carte des amis en direct.", "<strong>Network</strong>: a campus-only social app with a feed, stories, classmates, clubs, events and a live friends map."),
    ("<strong>Cartes</strong> : tu choisis une salle (ou un cours dans ton calendrier), Lync te guide dans les rues comme une app de cartes, puis passe tout seul au plan intérieur quand tu entres dans le bâtiment.", "<strong>Maps</strong>: pick a room (or a class in your calendar), Lync walks you through the streets like a maps app, then switches to the indoor floor plan by itself when you enter the building."),
    ("<strong>Étage par étage</strong> : l'app détecte l'étage par l'altitude et compte tes pas pour avancer le point sur le plan.", "<strong>Floor by floor</strong>: the app detects your floor from altitude and counts your steps to move the dot on the plan."),
    ("<strong>Données</strong> : 761 points de navigation, environ 300 salles, escaliers et ascenseurs reliés entre les étages.", "<strong>Data</strong>: 761 navigation nodes, about 300 rooms, stairs and elevators linked between floors."),
])) + block("03", "03", "Le défi technique : se repérer sans GPS", "The hard part: positioning without GPS", p(
    "À l'intérieur, l'app estime ta position <strong>pas à pas</strong> (navigation à l'estime, ou PDR). Chaque pas détecté fait avancer le point d'une longueur de pas, dans la direction où tu marches. Simple sur le papier, plein de pièges en vrai :",
    "Indoors, the app estimates your position <strong>step by step</strong> (pedestrian dead reckoning, PDR). Each detected step moves the dot by one step length, in the direction you are walking. Simple on paper, full of traps in practice:") + cards([
    ("Boussole", "Compass", "Le métal fausse le nord", "Metal breaks the compass", "Le magnétomètre saute près des structures en acier. On utilise un capteur d'orientation qui fusionne gyroscope et accéléromètre <strong>sans magnétomètre</strong> : pas de sauts, au prix d'un cap relatif au point de départ.", "The magnetometer jumps near steel structures. We use an orientation sensor that fuses gyroscope and accelerometer <strong>without the magnetometer</strong>: no jumps, at the cost of a heading relative to the starting point."),
    ("Temps", "Timing", "Des pas qui arrivent en retard", "Steps that arrive late", "Le détecteur de pas d'Android peut livrer un pas jusqu'à ~2 s après le contact du pied. On garde 2,5 s d'historique d'orientation pour retrouver le cap <strong>au moment exact du pas</strong>, pas le cap actuel.", "Android's step detector can deliver a step up to ~2 s after the foot lands. We keep 2.5 s of orientation history to recover the heading <strong>at the exact moment of the step</strong>, not the current one."),
    ("Maths", "Maths", "Moyenner des angles", "Averaging angles", "La moyenne de +179° et −179° n'est pas 0°. Le cap de chaque pas est une <strong>moyenne circulaire</strong> sur les 150 ms qui précèdent : θ = atan2(Σ sin θᵢ, Σ cos θᵢ).", "The average of +179° and −179° is not 0°. Each step's heading is a <strong>circular mean</strong> over the previous 150 ms: θ = atan2(Σ sin θᵢ, Σ cos θᵢ)."),
    ("Calibration", "Calibration", "Ta longueur de pas", "Your step length", "Au départ, tu marches 5 mètres : la longueur de pas vaut 5 m divisés par le nombre de pas, et elle doit rester plausible (entre 0,2 et 1,5 m). Sinon l'app demande de recommencer.", "At the start you walk 5 metres: step length is 5 m divided by the number of steps, and it must stay plausible (0.2 to 1.5 m). Otherwise the app asks you to redo it."),
]) + '<pre class="code"><span class="c">// for each accepted step</span>\n<span class="k">θ</span>   = meanHeadingAt(step.timestamp) − referenceYaw\n<span class="k">pos</span> = pos + (L · sin θ, L · cos θ)\n<span class="k">distance</span> += L</pre>') + block("04", "04", "Stack", "Stack", '<div class="stack"><span>Kotlin</span><span>Jetpack Compose</span><span>Swift</span><span>SwiftUI</span><span>Supabase</span><span>' + fr_en("Capteurs Android", "Android sensors") + '</span><span>' + fr_en("Tests unitaires", "Unit tests") + '</span></div>' + p(
    "L'app fonctionne aussi hors ligne avec des données de démonstration de Concordia, ce qui a permis de la présenter au jury sans dépendre du réseau.",
    "The app also runs offline on built-in Concordia demo data, which let us demo it to the judges without depending on the network.")) + """
  <figure class="media"><img src="../assets/img/lync/team-2.jpg" alt=""></figure>
  <div class="media-grid">
    <img src="../assets/img/lync/team-1.jpg" alt="">
    <img src="../assets/img/lync/photo-2.jpg" alt="">
    <img src="../assets/img/lync/photo-3.jpg" alt="">
  </div>
""" + foot("clofit.html", "Clofit")

# ---------------------------------------------------------------- CLOFIT
clofit = HEAD.format(title="Clofit", desc="Case study: Clofit, an iPhone app that turns the clothes you own into AI-made outfits matched to the weather.", og="../assets/img/clofit/site-hero.jpg", color="#B3A9F0") + f"""
  <section class="hero">
    <span class="kicker">{fr_en('Étude de cas, projet phare', 'Case study, flagship project')}</span>
    <h1>Clofit</h1>
    <p class="lede" data-lang="fr">« J'ai un dressing plein et rien à me mettre. » Clofit transforme les vêtements que tu possèdes déjà en tenues créées par IA, selon la météo, et te connecte à ton campus pour partager ton style.</p>
    <p class="lede" data-lang="en">"My closet is full and I have nothing to wear." Clofit turns the clothes you already own into AI-made outfits matched to the weather, and connects you with your campus to share your style.</p>
    {facts([('Plateforme', 'Platform', 'iPhone, gratuit', 'iPhone, free'), ('Langues', 'Languages', 'Français et anglais', 'French and English'), ('Public', 'Audience', '13 ans et plus, modéré', '13+, moderated'), ('Période', 'Timeline', '2025 – 2026', '2025 – 2026')])}
    <div class="actions"><a class="pill light" href="https://clofit.app" target="_blank" rel="noopener">{fr_en('Visiter clofit.app', 'Visit clofit.app')}</a></div>
  </section>
  <figure class="media"><img src="../assets/img/clofit/site-hero.jpg" alt=""></figure>
""" + block("01", "01", "Le problème", "The problem", p(
    "On porte toujours les mêmes vêtements, pas parce qu'on n'en a pas d'autres, mais parce qu'on ne les voit pas tous et qu'on n'a pas le temps de composer une tenue chaque matin. Les apps de mode existantes poussent surtout à acheter. Clofit part de <strong>ce que tu as déjà</strong>.",
    "We keep wearing the same clothes, not because we have nothing else, but because we can't see everything we own and have no time to put an outfit together every morning. Existing fashion apps mostly push you to buy. Clofit starts from <strong>what you already have</strong>.")) + block("02", "02", "Comment ça marche", "How it works", points([
    ("<strong>Une photo suffit</strong> : Clofit retire le fond et propose une fiche du vêtement (type, couleurs, style, coupe quand c'est identifiable). Tu corriges si besoin, et ton dressing se construit tout seul.", "<strong>One photo is enough</strong>: Clofit removes the background and suggests an item profile (type, colours, style, fit when identifiable). You fix anything, and your closet builds itself."),
    ("<strong>Tenue du jour</strong> : choisis un style (streetwear, old money, chic, sport, casual) et Clofit compose trois tenues à partir de tes vrais vêtements, selon la température dehors.", "<strong>Outfit of the day</strong>: pick a style (streetwear, old money, chic, sporty, casual) and Clofit builds three outfits from your real clothes, following the outside temperature."),
    ("<strong>Styliste IA</strong> : tu lui parles naturellement (« Streetwear pour ce soir », « Il fait −18°, je sors »). Ses réponses s'appuient sur ton dressing et tes préférences.", "<strong>AI stylist</strong>: you talk to it naturally (\"Streetwear for tonight\", \"It's −18°, I'm heading out\"). Its answers draw on your closet and preferences."),
    ("<strong>Social</strong> : OOTD qui reste 24 h, séries quotidiennes, fil de ton école et Vibe Rooms.", "<strong>Social</strong>: an OOTD that stays up 24 hours, daily streaks, your school's feed and Vibe Rooms."),
    ("<strong>En magasin</strong> : photographie un article et Clofit te dit avec quoi le porter et s'il complète vraiment ton dressing.", "<strong>In store</strong>: snap an item and Clofit shows what to wear it with and whether it really completes your closet."),
])) + """
  <div class="media-grid phones">
    <img src="../assets/img/clofit/app-closet.jpg" alt="">
    <img src="../assets/img/clofit/app-outfit.jpg" alt="">
    <img src="../assets/img/clofit/app-wishlist.jpg" alt="">
    <img src="../assets/img/clofit/app-profile.jpg" alt="">
  </div>
""" + block("03", "03", "Choix de conception", "Design decisions", cards([
    ("IA", "AI", "Deux modes de styliste", "Two stylist modes", "<strong>Studio</strong> explore plus loin le dressing et explique ses choix, <strong>Essentiel</strong> répond vite aux questions du quotidien. Des réponses approfondies quand il le faut, rapides le reste du temps.", "<strong>Studio</strong> looks deeper into the closet and explains its choices, <strong>Essential</strong> answers everyday questions fast. Deep answers when needed, quick ones the rest of the time."),
    ("Météo", "Weather", "La météo décide de la couche", "Weather picks the layer", "La température change la tenue proposée (une couche, manteau, etc.). On peut aussi désactiver la météo dans les réglages.", "Temperature changes the suggested outfit (one layer, coat, and so on). Weather can also be turned off in settings."),
    ("Confiance", "Trust", "Données jamais vendues", "Data never sold", "Une app qui voit ton dressing et tes photos doit être claire là-dessus : les données ne sont jamais vendues, et l'espace social est modéré, pour les 13 ans et plus.", "An app that sees your closet and photos has to be clear about it: data is never sold, and the social space is moderated, for ages 13 and up."),
    ("Rétention", "Retention", "Une raison de revenir chaque jour", "A reason to come back daily", "La tenue du jour, les séries et l'OOTD qui expire en 24 h donnent un rendez-vous quotidien, sans pousser à acheter.", "The outfit of the day, streaks and a 24-hour OOTD give a daily habit, without pushing anyone to buy."),
])) + block("04", "04", "Stack", "Stack", '<div class="stack"><span>Swift</span><span>SwiftUI</span><span>' + fr_en("Vision par ordinateur", "Computer vision") + '</span><span>LLMs</span><span>Python</span></div>') + foot("mini-robot.html", fr_en("Mini robot du gala", "Gala mini robot"))

# ---------------------------------------------------------------- MINI ROBOT
CODE = """<span class="c">// Smooth the joystick so the robot never jerks on stage</span>
mCurrentSpeed    += (targetSpeed    - mCurrentSpeed)    * <span class="n">kSmooth</span>;   <span class="c">// kSmooth = 0.2</span>
mCurrentRotation += (targetRotation - mCurrentRotation) * <span class="n">kSmooth</span>;

<span class="c">// Right trigger = precision mode: the harder you press, the slower it goes</span>
mDrivetrain-&gt;<span class="k">DriveRobot</span>(
  -(mCurrentSpeed    * kSpeed        * (1.2 - rightTrigger)),
  -(mCurrentRotation * kRotationRate * (1.2 - rightTrigger)));"""

robot = HEAD.format(title="Gala mini robot", desc="Case study: the StanRobotix 6622 mini robot built for the Collège Stanislas gala, C++ with WPILib.", og="../assets/img/hardware/frc-robot/frc-robot-6622-2025.png", color="var(--hw)") + f"""
  <section class="hero">
    <span class="kicker">{fr_en('Étude de cas, matériel', 'Case study, hardware')}</span>
    <h1>{fr_en('Mini robot du gala', 'Gala mini robot')}</h1>
    <p class="lede" data-lang="fr">Un petit robot à deux roues pour traverser la scène du gala du Collège Stanislas devant le public : piloté à la manette, sans à-coups, avec des LEDs qui réagissent à ce qu'il fait.</p>
    <p class="lede" data-lang="en">A small two-wheel robot built to cross the stage at the Collège Stanislas gala in front of the audience: driven with a controller, no jerks, with LEDs that react to what it does.</p>
    {facts([('Équipe', 'Team', 'StanRobotix, FRC 6622', 'StanRobotix, FRC 6622'), ('Langage', 'Language', 'C++, WPILib', 'C++, WPILib'), ('Matériel', 'Hardware', '2 SPARK MAX, IMU Pigeon 2, LEDs', '2 SPARK MAX, Pigeon 2 IMU, LEDs'), ('Historique', 'History', '29 commits', '29 commits')])}
    <div class="actions"><a class="pill light" href="https://github.com/floragel/mini-robot" target="_blank" rel="noopener">{fr_en('Voir le code sur GitHub', 'View the code on GitHub')}</a></div>
  </section>
""" + block("01", "01", "La mission", "The mission", p(
    "Sur une scène, devant des centaines de personnes, un robot qui donne un coup brusque ou qui ne répond plus, ça se voit tout de suite. Il fallait un robot <strong>fiable, doux à piloter et lisible</strong> : le public doit comprendre ce qu'il fait.",
    "On stage, in front of hundreds of people, a robot that lurches or stops responding is obvious immediately. It had to be <strong>reliable, smooth to drive and readable</strong>: the audience should understand what it is doing.")) + block("02", "02", "Ma part", "My part", points([
    ("<strong>Conduite</strong> : le sous-système de transmission et la commande de pilotage (arcade : stick gauche pour avancer, stick droit pour tourner).", "<strong>Drive</strong>: the drivetrain subsystem and the drive command (arcade: left stick to move, right stick to turn)."),
    ("<strong>Débogage</strong> : le robot ne bougeait pas parce que le sous-système était créé deux fois (dans le conteneur et dans la commande), ce qui dupliquait les CAN ID des moteurs. Corrigé, avec l'initialisation des pointeurs.", "<strong>Debugging</strong>: the robot would not move because the subsystem was created twice (in the container and in the command), which duplicated the motors' CAN IDs. Fixed, along with pointer initialisation."),
    ("<strong>Accélération douce</strong> : une rampe sur la vitesse et la rotation pour éviter les à-coups.", "<strong>Smooth acceleration</strong>: a ramp on speed and rotation to avoid jerks."),
    ("<strong>Manette et LEDs</strong> : passage à la manette Xbox, et intégration des bandes de LEDs (dégradé qui défile, pulsation orange).", "<strong>Controller and LEDs</strong>: switch to the Xbox controller, and integration of the LED strips (scrolling gradient, orange pulse)."),
])) + block("03", "03", "Le code qui compte", "The code that matters", p(
    "Au lieu d'envoyer directement la valeur du joystick aux moteurs, chaque cycle rapproche la vitesse actuelle de la vitesse demandée de 20 %. Le résultat : un démarrage et un arrêt progressifs, même si on pousse le stick d'un coup.",
    "Instead of sending the joystick value straight to the motors, each cycle moves the current speed 20% closer to the requested speed. The result: progressive starts and stops, even if you slam the stick.") + f'<pre class="code">{CODE}</pre>') + block("04", "04", "Les LEDs racontent l'état du robot", "LEDs tell the robot's state", cards([
    ("Mouvement", "Moving", "Il roule", "It's driving", "Dès qu'un stick dépasse 20 %, les LEDs passent en mode « mouvement ».", "As soon as a stick passes 20%, the LEDs switch to \"moving\" mode."),
    ("Salut", "Wave", "Bouton Y", "Y button", "Un mode « waving » pour saluer le public pendant le gala.", "A \"waving\" mode to greet the audience during the gala."),
    ("Drift", "Drift", "LB et RB", "LB and RB", "Des commandes de drift à gauche ou à droite, avec l'IMU Pigeon 2.", "Left and right drift commands, using the Pigeon 2 IMU."),
    ("Arrêt", "Stop", "Bouton A", "A button", "Arrêt immédiat du robot tant que le bouton est maintenu.", "Immediate stop while the button is held."),
])) + block("05", "05", "Stack", "Stack", '<div class="stack"><span>C++</span><span>WPILib (command-based)</span><span>REV SPARK MAX</span><span>CTRE Pigeon 2</span><span>' + fr_en("LEDs adressables", "Addressable LEDs") + '</span><span>' + fr_en("Manette Xbox", "Xbox controller") + '</span></div>' + p(
    "Le projet est né dans le dépôt hors saison de l'équipe ; le dépôt public garde tout l'historique du mini robot.",
    "The project started in the team's off-season repository; the public repo keeps the mini robot's full history.")) + foot("lync.html", "Lync")

OUT.mkdir(exist_ok=True)
for name, doc in [("lync", lync), ("clofit", clofit), ("mini-robot", robot)]:
    (OUT / f"{name}.html").write_text(doc, encoding="utf-8")
    print("wrote", f"projets/{name}.html")
