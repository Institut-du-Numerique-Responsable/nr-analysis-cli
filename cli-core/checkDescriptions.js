/*
 * Why each criterion is evaluated. Plain-language sentences shown next to
 * the result in the HTML report. Keep < 200 chars per entry.
 */

const DESCRIPTIONS = {
    // ----- Cyber security -----
    Tls: "Protocole de chiffrement entre navigateur et serveur. TLS 1.3 supprime des aller-retours, ferme des failles connues (POODLE, BEAST) et économise du calcul.",
    Hsts: "Strict-Transport-Security force le navigateur à utiliser HTTPS et bloque les attaques de rétrogradation (SSL stripping) lors de la première connexion.",
    Csp: "Content-Security-Policy déclare les sources autorisées pour scripts/styles/images. Première ligne de défense contre les injections XSS et le vol de session.",
    XContentTypeOptions: "X-Content-Type-Options: nosniff empêche le navigateur de deviner un type MIME, évitant qu'un fichier malveillant soit exécuté comme script.",
    XFrameOptions: "X-Frame-Options (ou CSP frame-ancestors) bloque l'inclusion du site dans une iframe tierce, protégeant du clickjacking.",
    ReferrerPolicy: "Referrer-Policy limite les informations sur la page d'origine envoyées aux sites tiers, protégeant la vie privée et la confidentialité d'URLs internes.",
    PermissionsPolicy: "Permissions-Policy restreint l'accès des scripts tiers aux APIs sensibles (caméra, micro, géolocalisation, paiement).",
    CookieFlags: "Les flags Secure, HttpOnly et SameSite empêchent respectivement l'envoi en clair, la lecture JS et les attaques CSRF.",
    ServerLeak: "Les en-têtes Server/X-Powered-By divulguent la pile technique exacte, facilitant la recherche de CVE pour un attaquant.",
    SecurityTxt: "/.well-known/security.txt (RFC 9116) fournit un canal de signalement pour les chercheurs en sécurité — bonne hygiène de gestion des vulnérabilités.",
    HttpToHttpsRedirect: "Toute requête HTTP doit être redirigée vers HTTPS, sinon le contenu peut être intercepté et modifié sur des réseaux non sécurisés.",
    CrossOriginIsolation: "COOP/CORP isolent l'origine en mémoire, protégeant contre les attaques Spectre et permettant des APIs avancées (SharedArrayBuffer).",
    OcspStapling: "OCSP stapling permet au serveur de fournir la preuve de non-révocation du certificat. Évite un aller-retour vers l'autorité de certification (privacy + sobriété).",
    Dnssec: "DNSSEC signe cryptographiquement les réponses DNS et empêche le cache poisoning / spoofing — base d'une infra de confiance.",

    // ----- Server NR perf -----
    Compression: "La compression Brotli/Zstd/gzip réduit jusqu'à 80% le poids transféré : moins d'énergie, moins d'eau, moins de bande passante.",
    HttpVersion: "HTTP/2 et HTTP/3 multiplexent les requêtes sur une seule connexion, suppriment les handshakes redondants et accélèrent l'affichage.",
    CacheControl: "Les en-têtes Cache-Control / ETag évitent de retélécharger les ressources statiques à chaque visite — gain énergétique majeur pour les visiteurs récurrents.",
    DnsIpv6: "Un enregistrement AAAA permet la connexion IPv6, évite le double-stack NAT et prépare la fin de l'IPv4 publique (raréfaction des ressources).",
    DnsRedundancy: "Plusieurs IPs DNS garantissent la disponibilité si un point de présence tombe — résilience sans serveur dédié.",
    TlsResumption: "Le session ticket TLS permet de reprendre une session chiffrée sans relancer un handshake complet — économie CPU et latence.",
    Cdn: "Un CDN sert les contenus depuis le point de présence le plus proche : moins de distance parcourue par les paquets = moins d'énergie réseau.",

    // ----- Accessibility (Tanaguru) -----
    ImgAlt: "L'attribut alt décrit l'image aux lecteurs d'écran et s'affiche si l'image ne charge pas. RGAA 1.1 / WCAG 1.1.1.",
    DocumentLanguage: "L'attribut lang sur <html> indique aux lecteurs d'écran la bonne prononciation et améliore le SEO multilingue.",
    PageTitle: "Le <title> est le premier élément lu par un lecteur d'écran et identifie l'onglet — repère essentiel pour la navigation.",
    HeadingStructure: "Une hiérarchie h1→h6 sans saut permet la navigation au clavier et la table des matières des lecteurs d'écran.",
    FormLabel: "Chaque champ de formulaire doit être associé à un <label> pour que les lecteurs d'écran annoncent sa fonction.",
    LinkText: "Le texte d'un lien doit être explicite hors contexte. Les lecteurs d'écran proposent une liste de liens : « cliquez ici » devient illisible.",
    ButtonName: "Un bouton sans nom accessible est invisible pour les technologies d'assistance.",
    Landmarks: "Les balises <main>, <nav>, <header>, <footer> permettent aux lecteurs d'écran de sauter directement à une section.",
    TableHeaders: "Les <th> identifient les en-têtes de colonnes/lignes, permettant aux lecteurs d'écran d'annoncer la correspondance dans un tableau.",
    ColorContrast: "Un contraste insuffisant exclut les personnes malvoyantes ou en environnement lumineux fort. Seuil WCAG AA : 4.5:1.",
    IframeTitle: "L'attribut title d'une iframe annonce son contenu aux lecteurs d'écran avant qu'ils entrent dedans.",
    TabIndex: "Un tabindex positif perturbe l'ordre naturel de tabulation et désoriente les utilisateurs au clavier.",

    // ----- NR / privacy extras -----
    FontDisplaySwap: "font-display: swap affiche d'abord la police système puis remplace : évite la FOIT (texte invisible) et améliore la perception de vitesse.",
    FontPreload: "Précharger les polices critiques évite un flash de texte non stylé et accélère le rendu visuel.",
    FontSubset: "Un subset unicode-range ne charge que les caractères réellement utilisés — fichier divisé par 10 sur certaines langues.",
    ConsentBanner: "Le RGPD impose un consentement explicite avant tout cookie/tracker non essentiel. L'absence de bandeau = non-conformité légale.",
    ThirdPartyCookies: "Chaque domaine tiers représente une fuite potentielle de données personnelles et un point de défaillance (performance + privacy).",
};

function describe(id) { return DESCRIPTIONS[id] || ''; }

module.exports = { describe, DESCRIPTIONS };
