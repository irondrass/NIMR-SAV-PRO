/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  UserRole, 
  DossierStatus, 
  DossierPriority, 
  InterventionType, 
  AtelierZone, 
  DossierSAV,
  TechnicienResource,
  ReclammationClient,
  ActiviteLog
} from "./types";

export const MOCK_TECHNICIENS: TechnicienResource[] = [
  {
    id: "tech_01",
    nom: "Technicien Démo 001",
    specialite: "Diagnostic Électrique / Hybride",
    disponibilite: "occupe",
    compétences: ["Diagnostic OBD", "Habilitation Électrique EV", "Climatisation"],
    zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
    absencesConges: ["2026-06-15 (Congé annuel)"],
    capaciteJournaliere: 8,
    chargeActuelle: 6.5
  },
  {
    id: "tech_02",
    nom: "Technicien Démo 002",
    specialite: "Mécanique Lourde & Transmission",
    disponibilite: "disponible",
    compétences: ["Boîte de vitesse automatique", "Moteur thermique Dongfeng", "Train roulant"],
    zoneAffectee: AtelierZone.GRANDS_TRAVAUX,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 4.0
  },
  {
    id: "tech_03",
    nom: "Technicien Démo 003",
    specialite: "Entretien Rapide / Freinage",
    disponibilite: "disponible",
    compétences: ["Vidange & Filtres", "Plaquettes de frein", "Suspension"],
    zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 2.0
  },
  {
    id: "tech_04",
    nom: "Technicien Démo 004",
    specialite: "Tôlerie & Redressage",
    disponibilite: "occupe",
    compétences: ["Géométrie marbre", "Soudure aluminium", "Débosselage sans peinture"],
    zoneAffectee: AtelierZone.CARROSSERIE,
    absencesConges: [],
    capaciteJournaliere: 8,
    chargeActuelle: 7.0
  },
  {
    id: "tech_05",
    nom: "Technicien Démo 005",
    specialite: "Peinture & Finition",
    disponibilite: "occupe",
    compétences: ["Colorimétrie assistée", "Peinture nacrée", "Polissage"],
    zoneAffectee: AtelierZone.PEINTURE,
    absencesConges: ["2026-06-25 (RDV médical AM)"],
    capaciteJournaliere: 8,
    chargeActuelle: 8.0
  }
];

export const INITIAL_DOSSIERS: DossierSAV[] = [
  {
    id: "NIMR-2026-001",
    clientNom: "Client Démo 001",
    clientTelephone: "+216 20 000 001",
    deposantNom: "Client Démo 001",
    deposantTelephone: "+216 20 000 001",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO (Hybride)",
    vehiculeImmatriculation: "000 TU 0001",
    vehiculeVIN: "DEMOVIN000000001",
    vehiculeKilometrage: 42300,
    vehiculeCouleur: "Gris Magnétique",
    typeDossier: InterventionType.ELECTRICITE_DIAG,
    priorite: DossierPriority.URGENTE,
    plainteClient: "Voyant moteur allumé sur le tableau de bord + perte intermittente de puissance lors des phases d'accélération en mode électrique.",
    observationsReception: "Véhicule propre globalement, micro-rayures sur l'aile arrière gauche.",
    photosAvant: [
      { id: "ph_1_a", url: "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=400&auto=format&fit=crop&q=60", title: "Face Avant", date: "2026-06-09", takenBy: "Réceptionnaire Démo", category: "réception avant" },
      { id: "ph_1_b", url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=60", title: "Aile AR Gauche Rayure", date: "2026-06-09", takenBy: "Réceptionnaire Démo", category: "défaut carrosserie" }
    ],
    niveauCarburant: 65,
    etatCarrosserie: {
      rayures: true,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "Micro-rayures superficielles légères sur l'aile arrière gauche."
    },
    objetsLaisses: ["Chargeur de secours pour smartphone", "Câble de recharge Type 2"],
    dateReception: "2026-06-09T08:30:00Z",
    dateSouhaiteeLivraison: "2026-06-11T17:00:00Z",
    statut: DossierStatus.EN_TRAVAUX,
    technicienId: "tech_01",
    zoneAtelier: AtelierZone.ELECTRICITE_DIAG,
    ordresReparation: [
      { id: "ro_1", designation: "Diagnostic système de gestion batterie hybride (BMS)", tempsEstime: 1.5, tempsPasse: 1.5, status: "done" },
      { id: "ro_2", designation: "Mise à jour du logiciel calculateur de puissance", tempsEstime: 1.0, tempsPasse: 0.5, status: "in_progress" },
      { id: "ro_3", designation: "Remplacement connecteur haute tension faisceaux secondaires", tempsEstime: 2.0, tempsPasse: 0, status: "pending" }
    ],
    complements: [
      {
        id: "comp_1",
        titre: "Protection isolante de faisceau bouffée par des rongeurs",
        description: "Constaté lors de la dépose du carter principal. Obligation de sécuriser avec de la bande isolante haute résistance pour éviter court-circuit.",
        tempsEstime: 1.2,
        impactPlanning: "Retard de +1H",
        accordRequis: "client",
        statut: "attente",
        photos: []
      }
    ],
    accords: [
      {
        id: "acc_1",
        type: "Client",
        destinataire: "Client Démo 001",
        dateEnvoi: "2026-06-09T11:00:00Z",
        statut: "en_attente",
        commentaire: "Proposition envoyée par SMS et mail pour prise en charge du complément 'Faisceau isolé' (Tarif MO uniquement, pièce hors garantie)."
      }
    ],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: true,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-11T17:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Suivre l'accord client pour le complément faisceau rongeurs",
    dateDernierStatut: "2026-06-09T13:45:00Z",
    avancementGlobal: 40
  },
  {
    id: "NIMR-2026-002",
    clientNom: "Client Démo 002",
    clientTelephone: "+216 20 000 002",
    deposantNom: "Client Démo 002",
    deposantTelephone: "+216 20 000 002",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "Aeolus Huge (Thermique)",
    vehiculeImmatriculation: "000 TU 0002",
    vehiculeVIN: "DEMOVIN000000002",
    vehiculeKilometrage: 12100,
    vehiculeCouleur: "Bleu Minuit",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Premier entretien systématique des 10 000 km + bruit de sifflement d'air aérodynamique léger côté conducteur au-dessus de 90 km/h.",
    observationsReception: "Parfait état. Pas d'anomalie carrosserie.",
    photosAvant: [
      { id: "ph_2_a", url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=60", title: "Profil Droit", date: "2026-06-09", takenBy: "Réceptionnaire Démo", category: "côté droit" }
    ],
    niveauCarburant: 85,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "Véhicule comme neuf."
    },
    objetsLaisses: ["Lunettes de soleil (boîtier) dans la boîte à gants"],
    dateReception: "2026-06-09T09:15:00Z",
    dateSouhaiteeLivraison: "2026-06-09T16:00:00Z",
    statut: DossierStatus.PRET_A_LIVRER,
    technicienId: "tech_03",
    zoneAtelier: AtelierZone.LAVAGE_FINITION,
    ordresReparation: [
      { id: "ro_4", designation: "Vidange d'huile moteur + filtre à huile + filtre habitacle", tempsEstime: 0.8, tempsPasse: 0.8, status: "done" },
      { id: "ro_5", designation: "Contrôle des 30 points critiques & mise à niveau liquides", tempsEstime: 0.5, tempsPasse: 0.6, status: "done" },
      { id: "ro_6", designation: "Vérification des joints de portières (problème bruit aérodynamique)", tempsEstime: 0.5, tempsPasse: 0.5, status: "done" }
    ],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: true,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: true,
      propreteVehicule: true,
      documentsPrets: true,
      photosApresOk: true,
      validationGlobale: "valide",
      dateValidation: "2026-06-09T14:30:00Z",
      validePar: "Contrôle Qualité Démo (Qualité)"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-09T16:00:00Z",
      remarquesLivraison: "Sifflement venait d'un joint de porte conducteur légèrement pincé de travers en usine. Repositionné et graissé sous garantie constructeur.",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Appeler le client pour confirmation heure de livraison",
    dateDernierStatut: "2026-06-09T14:35:00Z",
    avancementGlobal: 95
  },
  {
    id: "NIMR-2026-003",
    clientNom: "Client Démo 003",
    clientTelephone: "+216 20 000 003",
    deposantNom: "Client Démo 003",
    deposantTelephone: "+216 20 000 003",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 580 (SUV 7 Places)",
    vehiculeImmatriculation: "000 TU 0003",
    vehiculeVIN: "DEMOVIN000000003",
    vehiculeKilometrage: 87600,
    vehiculeCouleur: "Blanc Nacré",
    typeDossier: InterventionType.ASSURANCE,
    priorite: DossierPriority.VEHICULE_IMMOBILISE,
    plainteClient: "Choc arrière droit suite à collision sur rond-point. Bouclier cassé, capteurs d'aide au stationnement désactivés, aile enfoncée, coffre difficile à fermer.",
    observationsReception: "Bouclier AR détruit en partie gauche, tôle de passage de roue enfoncée.",
    photosAvant: [
      { id: "ph_3_a", url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=60", title: "Choc Arrière Droit", date: "2026-06-08", takenBy: "Réceptionnaire Démo", category: "défaut carrosserie" }
    ],
    niveauCarburant: 40,
    etatCarrosserie: {
      rayures: true,
      bosses: true,
      fissureParbrise: false,
      jantesAbimees: true,
      autresNotes: "Choc violent arrière ayant déformé le pare-choc et le renfort transversal arrière."
    },
    objetsLaisses: [],
    dateReception: "2026-06-08T10:00:00Z",
    dateSouhaiteeLivraison: "2026-06-18T12:00:00Z",
    statut: DossierStatus.EN_ATTENTE_ACCORD,
    ordresReparation: [
      { id: "ro_7", designation: "Démontage pare-choc AR et pare-boue pour chiffrage expert", tempsEstime: 1.5, tempsPasse: 1.5, status: "done" },
      { id: "ro_8", designation: "Mise sur marbre pour redressage de traverse arrière", tempsEstime: 4.0, tempsPasse: 0, status: "pending" },
      { id: "ro_9", designation: "Peinture complète bouclier AR et flanc droit", tempsEstime: 3.5, tempsPasse: 0, status: "pending" }
    ],
    complements: [
      {
        id: "comp_2",
        titre: "Remplacement absorbeur de choc métallique interne + 2 radars de recul",
        description: "L'expert de l'assurance n'avait pas listé la traverse déformée sous le plastique de protection arrière droit. Nécessité de soumettre un rapport photo.",
        tempsEstime: 2.5,
        impactPlanning: "Attente livraison pièce (+3 jours)",
        accordRequis: "assurance",
        statut: "attente",
        photos: []
      }
    ],
    accords: [
      {
        id: "acc_2",
        type: "Assurance",
        destinataire: "GAT Assurance - Tunisie (Expert M. Bourguiba)",
        dateEnvoi: "2026-06-08T15:00:00Z",
        dateRelance: "2026-06-09T10:00:00Z",
        statut: "en_attente",
        commentaire: "Dossier sinistre d'assurance envoyé. En attente du PV de l'expert de la GAT pour valider la prise en charge des capteurs radars suppl."
      }
    ],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-18T12:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Relancer d'urgence l'expert d'assurance GAT",
    dateDernierStatut: "2026-06-09T09:00:00Z",
    avancementGlobal: 15
  },
  {
    id: "NIMR-2026-004",
    clientNom: "Client Démo 004",
    clientTelephone: "+216 20 000 004",
    deposantNom: "Client Démo 004",
    deposantTelephone: "+216 20 000 004",
    vehiculeMarque: "Dongfeng",
    vehiculeModele: "S50EV (100% Électrique)",
    vehiculeImmatriculation: "000 TU 0004",
    vehiculeVIN: "DEMOVIN000000004",
    vehiculeKilometrage: 55400,
    vehiculeCouleur: "Gris Quartz",
    typeDossier: InterventionType.DIAGNOSTIC,
    priorite: DossierPriority.VEHICULE_IMMOBILISE,
    plainteClient: "Véhicule ne charge pas sur borne AC triphasée (recharge rapide DC OK). Message de défaut de charge rouge au tableau de bord.",
    observationsReception: "Câble de recharge d'origine usé au niveau du manchon plastique.",
    photosAvant: [],
    niveauCarburant: 12,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "Bon état."
    },
    objetsLaisses: [],
    dateReception: "2026-06-09T11:00:00Z",
    dateSouhaiteeLivraison: "2026-06-11T12:00:00Z",
    statut: DossierStatus.BLOQUE,
    bloqueRaison: "Bornes d'essai AC de l'atelier occupées / Attente outillage diagnostic spécifique chargeur embarqué (OBC).",
    ordresReparation: [
      { id: "ro_10", designation: "Lecture mémoire défaut de charge et télésurveillance", tempsEstime: 1.0, tempsPasse: 0.5, status: "blocked" },
      { id: "ro_11", designation: "Contrôle impédance de ligne & relais de sécurité OBC", tempsEstime: 2.0, tempsPasse: 0, status: "pending" }
    ],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-11T12:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Libérer une borne AC d'atelier ou relancer le technicien démo",
    dateDernierStatut: "2026-06-09T14:10:00Z",
    avancementGlobal: 25
  },
  {
    id: "NIMR-2026-005",
    clientNom: "Client Démo 005",
    clientTelephone: "+216 20 000 005",
    deposantNom: "Déposant Démo 005",
    deposantTelephone: "+216 20 000 006",
    vehiculeMarque: "DFSK",
    vehiculeModele: "Glory 500",
    vehiculeImmatriculation: "000 TU 0005",
    vehiculeVIN: "DEMOVIN000000005",
    vehiculeKilometrage: 24700,
    vehiculeCouleur: "Rouge Rubis",
    typeDossier: InterventionType.GARANTIE_CONSTRUCTEUR,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Climatisation souffle de l'air tiède uniquement. Sensation d'inefficacité totale même réglée au maximum.",
    observationsReception: "Pare-chocs avant légèrement frotté à droite.",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: {
      rayures: true,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "Frottement superficiel bouclier avant droit."
    },
    objetsLaisses: [],
    dateReception: "2026-06-09T07:45:00Z",
    dateSouhaiteeLivraison: "2026-06-10T16:00:00Z",
    statut: DossierStatus.CONTROLE_QUALITE,
    technicienId: "tech_01",
    zoneAtelier: AtelierZone.CONTROLE_QUALITE,
    ordresReparation: [
      { id: "ro_12", designation: "Contrôle étanchéité circuit de clim (R134a)", tempsEstime: 1.0, tempsPasse: 1.0, status: "done" },
      { id: "ro_13", designation: "Remplacement condenseur de clim fuyard sous garantie constructeur", tempsEstime: 2.5, tempsPasse: 2.3, status: "done" },
      { id: "ro_14", designation: "Recharge de gaz clim et contrôle de température différentielle", tempsEstime: 1.0, tempsPasse: 1.0, status: "done" }
    ],
    complements: [],
    accords: [
      {
        id: "acc_3",
        type: "Garantie Constructeur",
        destinataire: "Dongfeng / DFSK Moyen-Orient (M. Wang)",
        dateEnvoi: "2026-06-09T08:15:00Z",
        statut: "approuve",
        commentaire: "Prise en charge acceptée en garantie constructeur pour défaut de soudure d'usine condenseur principal."
      }
    ],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: true,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: "2026-06-10T16:00:00Z",
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Compléter la checklist de contrôle qualité par l'essayeur",
    dateDernierStatut: "2026-06-09T14:45:00Z",
    avancementGlobal: 85
  },
  {
    id: "NIMR-2026-006",
    clientNom: "Client Démo 006",
    clientTelephone: "+216 20 000 006",
    deposantNom: "Client Démo 006",
    deposantTelephone: "+216 20 000 006",
    vehiculeMarque: "Forthing",
    vehiculeModele: "U-Tour (Monospace)",
    vehiculeImmatriculation: "000 TU 0006",
    vehiculeVIN: "DEMOVIN000000006",
    vehiculeKilometrage: 10500,
    vehiculeCouleur: "Bleu Océan",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Entretien des 10 000 km réglementaire selon les préconisations NIMR.",
    observationsReception: "Véhicule en excellent état, pas de chocs.",
    photosAvant: [],
    niveauCarburant: 45,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: "R.A.S."
    },
    objetsLaisses: [],
    dateReception: "2026-06-10T08:00:00Z",
    dateSouhaiteeLivraison: "2026-06-10T12:00:00Z",
    statut: DossierStatus.LIVRE,
    technicienId: "tech_01",
    zoneAtelier: AtelierZone.MECANIQUE_RAPIDE,
    ordresReparation: [
      { id: "ro_15", designation: "Vidange moteur + remplacement filtre à huile", tempsEstime: 0.8, tempsPasse: 0.8, status: "done" }
    ],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: true,
      defautRepare: true,
      aucunVoyantAllume: true,
      niveauxVerifies: true,
      serrageSecurite: true,
      propreteVehicule: true,
      documentsPrets: true,
      photosApresOk: true,
      validationGlobale: "valide",
      dateValidation: "2026-06-10T10:30:00Z"
    },
    livraison: {
      controleQualiteOk: true,
      clientInforme: true,
      dateLivraisonPrevue: "2026-06-10T12:00:00Z",
      dateLivraisonReelle: "2026-06-10T11:15:00Z",
      remarquesLivraison: "Restitution effectuée en mains propres. Kilométrage de sortie vérifié.",
      confirmationReceptionClient: true,
      clotureInterne: true,
      kilometrageSortie: 10505
    },
    prochaineActionRecommended: "Dossier entièrement livré et clôturé.",
    dateDernierStatut: "2026-06-10T11:15:00Z",
    avancementGlobal: 100,
    historiqueLogs: [
      "2026-06-10T11:15:00.000Z - [LIVRAISON] - Restitution validée. Dossier statut mis à LIVRE. KM Sortie: 10505.",
      "2026-06-10T10:30:00.000Z - [CONTROLE_QUALITE] - Validation QC positive.",
      "2026-06-10T10:15:00.000Z - Tâche \"Vidange moteur + remplacement filtre à huile\" terminée",
      "2026-06-10T09:30:00.000Z - Tâche \"Vidange moteur + remplacement filtre à huile\" démarrée",
      "2026-06-10T08:00:00.000Z - [RECEPTIONNAIRE] - Dossier créé pour Forthing U-Tour."
    ]
  }
];

export const INITIAL_RECLAMATIONS: ReclammationClient[] = [
  {
    id: "REC-2026-001",
    dossierId: "NIMR-2026-002",
    clientNom: "Client Démo 002",
    vehiculeNom: "Dongfeng Aeolus Huge - 000 TU 0002",
    immatriculation: "000 TU 0002",
    motif: "Traces de graisse noire sur le montant en tissu beige intérieur conducteur après contrôle du joint.",
    criticite: "moyenne",
    responsable: "Réceptionnaire Démo (Réceptionnaire)",
    statut: "nouvelle",
    actionCorrective: "Nettoyage à sec professionnel immédiat de la garniture de pavillon.",
    delaiCible: "2026-06-09T16:00:00Z",
    delaiTraitement: "Aujourd'hui, avant la livraison finale (16:00)",
    dateCreation: "2026-06-09T14:40:00Z",
    dateDerniereModification: "2026-06-09T14:40:00Z",
    historiqueActions: [
      {
        id: "hist_rec_2026_001_creation",
        date: "2026-06-09T14:40:00Z",
        utilisateur: "Réceptionnaire Démo",
        role: "Réceptionnaire",
        action: "Création réclamation",
        nouveauStatut: "nouvelle",
        commentaire: "Réclamation enregistrée par réceptionnaire.",
      }
    ],
    historiqueLogs: ["2026-06-09T14:40:00Z - Réclamation enregistrée par réceptionnaire."]
  },
  {
    id: "REC-2026-002",
    dossierId: "NIMR-2026-001",
    clientNom: "Client Démo 001",
    vehiculeNom: "Forthing T5 EVO - 000 TU 0001",
    immatriculation: "000 TU 0001",
    motif: "Délai de réponse d'acceptation de devis jugé excessif de la part de l'assurance suite à retard de diagnostic.",
    criticite: "haute",
    responsable: "Responsable Démo SAV (Directeur SAV)",
    statut: "en_analyse",
    actionCorrective: "Appeler directement le directeur d'agence de l'assurance et lui proposer un véhicule de courtoisie Forthing.",
    delaiCible: "2026-06-10T15:00:00Z",
    delaiTraitement: "Moins de 24 heures",
    dateCreation: "2026-06-09T15:00:00Z",
    dateDerniereModification: "2026-06-09T15:05:00Z",
    historiqueActions: [
      {
        id: "hist_rec_2026_002_analyse",
        date: "2026-06-09T15:05:00Z",
        utilisateur: "Responsable Démo SAV",
        role: "Directeur SAV",
        action: "Statut réclamation: En analyse",
        ancienStatut: "nouvelle",
        nouveauStatut: "en_analyse",
        commentaire: "Directeur SAV prend personnellement le dossier en main.",
      },
      {
        id: "hist_rec_2026_002_creation",
        date: "2026-06-09T15:00:00Z",
        utilisateur: "Réceptionnaire Démo",
        role: "Réceptionnaire",
        action: "Création réclamation",
        nouveauStatut: "nouvelle",
        commentaire: "Réclamation signalée par le client.",
      }
    ],
    historiqueLogs: [
      "2026-06-09T15:00:00Z - Réclamation signalée par le client.",
      "2026-06-09T15:05:00Z - Directeur SAV prend personnellement le dossier en main."
    ]
  }
];

export const INITIAL_ACTIVITE_LOGS: ActiviteLog[] = [
  {
    id: "log_1",
    timestamp: "2026-06-09T07:45:00Z",
    user: "Réceptionnaire Démo",
    role: "Réceptionnaire",
    action: "Création dossier",
    details: "Création réussite du dossier NIMR-2026-005 pour la DFSK Glory 500."
  },
  {
    id: "log_2",
    timestamp: "2026-06-09T08:15:00Z",
    user: "Réceptionnaire Démo",
    role: "Réceptionnaire",
    action: "Demande de Garantie",
    details: "Soumission de la demande d'accord garantie constructeur NIMR-2026-005 pour le condenseur de climatisation."
  },
  {
    id: "log_3",
    timestamp: "2026-06-09T08:30:00Z",
    user: "Réceptionnaire Démo",
    role: "Réceptionnaire",
    action: "Réception Véhicule",
    details: "Création du dossier NIMR-2026-001 pou la Forthing T5 EVO et affectation à la zone d'Électricité."
  },
  {
    id: "log_4",
    timestamp: "2026-06-09T09:30:00Z",
    user: "Chef Atelier Démo",
    role: "Chef d’atelier",
    action: "Affectation Technicien",
    details: "Affectation du technicien Technicien Démo 001 sur le dossier NIMR-2026-001 (Forthing T5 EVO)."
  },
  {
    id: "log_5",
    timestamp: "2026-06-09T11:00:00Z",
    user: "Technicien Démo 001",
    role: "Technicien",
    action: "Démarrage Tâche",
    details: "Début de la tâche 'Diagnostic BMS' sur la Forthing T5 EVO."
  },
  {
    id: "log_6",
    timestamp: "2026-06-09T13:45:00Z",
    user: "Technicien Démo 001",
    role: "Technicien",
    action: "Fin partielle de tâche",
    details: "Marqué la tâche 'Diagnostic BMS' comme TERMINÉE et début de la tâche de mise à jour du BMS."
  },
  {
    id: "log_7",
    timestamp: "2026-06-09T14:10:00Z",
    user: "Chef Atelier Démo",
    role: "Chef d’atelier",
    action: "Changement de statut",
    details: "Dossier NIMR-2026-004 marqué comme BLOQUÉ pour cause d'encombrement du pôle diagnostic AC."
  },
  {
    id: "log_8",
    timestamp: "2026-06-09T14:30:00Z",
    user: "Contrôle Qualité Démo",
    role: "Contrôle Qualité",
    action: "Validation Qualité",
    details: "Validation du contrôle qualité suite à l'essai routier réussi pour la Dongfeng Aeolus (NIMR-2026-002)."
  }
];

export const OPERATIONAL_METRICS_SUGGESTION = [
  "Relancer l'expert GAT pour débloquer les travaux de carrosserie du dossier NIMR-2026-003.",
  "Libérer l'outillage de diagnostic AC pour débloquer le diagnostic de la Dongfeng S50EV (NIMR-2026-004).",
  "Aviser le client Client Démo 001 de l'accord de garantie complémentaire.",
  "Mettre au nettoyage la garniture de pavillon de Client Démo 002 (NIMR-2026-002) pour traiter sa réclamation."
];
