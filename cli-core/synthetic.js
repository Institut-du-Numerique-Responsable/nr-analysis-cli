// Synthetic score combining EcoIndex (structural complexity) + SWDM v4 (contextualized GES).
// The two are complementary, not interchangeable:
//   - EcoIndex penalizes DOM nodes, HTTP requests, payload (independent of grid mix).
//   - SWDM v4 weights transferred bytes via grid intensity + hosting + cache ratio.
// Refs: https://www.ecoindex.fr/comment-ca-marche/ · https://sustainablewebdesign.org/estimating-digital-emissions/

const SWD_REFERENCE_GRAMS = 1.0;   // 2024 web average per visit (SWDM v4)
const SWD_WORST_GRAMS = 4.0;       // 4× average → score = 0
const DEFAULT_WEIGHTS = { ecoindex: 0.5, co2js: 0.5 };

function normalizeSwd(co2Grams) {
    return Math.max(0, Math.min(100, 100 - (co2Grams / SWD_WORST_GRAMS) * 100));
}

function scoreToGrade(score) {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    if (score >= 20) return 'E';
    if (score >= 5) return 'F';
    return 'G';
}

function buildRationale(ecoNorm, swdNorm, confidence, ctx) {
    const parts = [];
    if (confidence === 'low') {
        if (ecoNorm < swdNorm) {
            parts.push(
                `EcoIndex bas (${Math.round(ecoNorm)}/100) — page lourde structurellement ` +
                    `(DOM/requêtes/poids) — alors que SWD reste faible (${Math.round(swdNorm)}/100) ` +
                    `grâce ${ctx.greenHosting ? "à l'hébergement vert" : 'au mix électrique local'} ` +
                    `(${ctx.gridIntensity} gCO₂/kWh).`
            );
        } else {
            parts.push(
                `SWD bas (${Math.round(swdNorm)}/100) — empreinte CO₂ élevée liée ` +
                    `au mix électrique ou à l'hébergement non vert — alors qu'EcoIndex reste correct ` +
                    `(${Math.round(ecoNorm)}/100). Optimisation hébergement à prioriser.`
            );
        }
    } else if (confidence === 'medium') {
        parts.push(
            `Les deux modèles convergent partiellement (${Math.round(ecoNorm)}/100 vs ` +
                `${Math.round(swdNorm)}/100). Marge de progrès sur les deux dimensions.`
        );
    } else {
        parts.push(
            `Les deux modèles convergent (${Math.round(ecoNorm)}/100 vs ${Math.round(swdNorm)}/100). ` +
                `Diagnostic stable, recommandations fiables.`
        );
    }
    return parts.join(' ');
}

function computeSynthetic(ecoIndexResult, co2Result, weights = DEFAULT_WEIGHTS) {
    const ecoNorm = ecoIndexResult.ecoIndex || 0;
    const swdNorm = normalizeSwd(co2Result.value);
    const score = Math.round(weights.ecoindex * ecoNorm + weights.co2js * swdNorm);
    const gap = Math.abs(ecoNorm - swdNorm);
    const confidence = gap < 15 ? 'high' : gap < 30 ? 'medium' : 'low';
    const rationale = buildRationale(ecoNorm, swdNorm, confidence, {
        greenHosting: co2Result.greenHosting,
        gridIntensity: co2Result.gridIntensity,
    });
    return {
        score,
        grade: scoreToGrade(score),
        confidence,
        rationale,
        components: {
            ecoIndexNormalized: Math.round(ecoNorm),
            swdNormalized: Math.round(swdNorm),
            weights,
            referenceSwdGrams: SWD_REFERENCE_GRAMS,
        },
    };
}

function buildRecommendations(action, ecoIndexResult, co2Result, synthetic) {
    const recs = [];
    const dom = action.domSize || 0;
    const req = action.nbRequest || 0;
    const kb = (action.responsesSize || 0) / 1000;

    if (dom > 1500) recs.push(`DOM trop dense (${dom} éléments) — simplifier le markup, supprimer wrappers inutiles.`);
    else if (dom > 800) recs.push(`DOM dense (${dom} éléments) — viser < 800 nœuds.`);

    if (req > 70) recs.push(`Nombre de requêtes élevé (${req}) — consolider CSS/JS, sprites, bundling.`);
    else if (req > 40) recs.push(`${req} requêtes — viser < 40 pour pages publiques.`);

    if (kb > 2000) recs.push(`Poids transféré ${Math.round(kb)} Ko — viser < 1 000 Ko, audit images/JS.`);
    else if (kb > 1000) recs.push(`Poids transféré ${Math.round(kb)} Ko — marge sur images modernes (AVIF/WebP).`);

    if (!co2Result.greenHosting) {
        recs.push(`Hébergement non détecté vert — migrer vers fournisseur certifié (Green Web Foundation).`);
    }

    if (co2Result.gridIntensity > 300) {
        recs.push(
            `Mix électrique de référence carboné (${co2Result.gridIntensity} gCO₂/kWh) — datacenter dans pays bas-carbone si possible.`
        );
    }

    if (ecoIndexResult.ecoIndex < 35 && synthetic.confidence === 'low') {
        recs.push(`Divergence forte EcoIndex/SWD — priorité écoconception structurelle avant gains hébergement.`);
    }

    return recs;
}

module.exports = { computeSynthetic, buildRecommendations, scoreToGrade };
