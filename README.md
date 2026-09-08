# 🏠 ColocPot - Tickets de caisse & Pot Commun Coloc

Application web & mobile (PWA) conçue spécialement pour les colocations afin de simplifier la gestion des courses et des factures partagées.

## 🌟 Fonctionnalités Clés

1. **📸 Scan de Tickets en Conditions Dégradées & Factures PDF** :
   - Lecture par IA multimodale (Google Gemini 1.5/2.5 Flash) capable de déchiffrer les tickets de caisse thermiques froissés, pliés, sombres ou pris de biais.
   - Outils de redressement intégrés : rotation 90° et amélioration automatique du contraste/netteté pour les photos prises au smartphone.
   - Support des factures PDF (EDF, box internet, reçus de commandes en ligne).

2. **🥦 100% Coloc par défaut & Ventilation Perso** :
   - Tous les articles scannés sont automatiquement affectés au pot commun.
   - Isolez en 1 clic vos achats personnels (ex: shampoing, paquet de cookies) pour qu'ils ne soient pas facturés à vos colocataires.
   - Contrôle d'intégrité en temps réel : $\text{Total Ticket} = \text{Part Coloc} + \text{Part Perso}$.

3. **🎙️ Mode Vocal "Coloc Flemmard"** :
   - Dictez simplement à l'oral vos consignes en 5 secondes :
     > *« Garde pour moi le gel douche et les chocolats, le reste c'est pour la coloc »*
   - L'IA fait correspondre les termes parlés avec les libellés raccourcis du ticket de caisse et bascule automatiquement les lignes en **Perso** !

4. **📱 Mini-App personnalisée pour chaque colocataire** :
   - Sélection du profil en 1 clic (Alex, Sam, Camille ou nouveau coloc).
   - Le profil reste mémorisé sur chaque smartphone.
   - Tableau de bord personnalisé : *« Bonjour Alex ! La coloc te doit 24,50 € »*.
   - Installation directe sur l'écran d'accueil du smartphone (PWA).

5. **⚖️ Équilibrage Tricount & Règlements** :
   - Calcul des soldes nets en temps réel.
   - Algorithme de simplification des dettes (minimum de virements entre colocs).
   - Bouton « Régler » avec animation de confettis.

---

## 🚀 Démarrage Rapide

### 1. Lancer l'application en développement
```bash
npm run dev
```
Rendez-vous sur [http://localhost:3000](http://localhost:3000).

### 2. Clé d'API Google Gemini
Pour utiliser la vision IA sur vos vrais tickets de caisse :
1. Obtenez une clé gratuite sur [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Renseignez-la soit :
   - Directement dans l'application en cliquant sur l'icône ⚙️ **Paramètres**.
   - Ou dans un fichier `.env.local` : `GEMINI_API_KEY="votre_cle"`.

> **Note** : L'application intègre un bouton **« Tester direct avec ticket démo »** permettant de tester immédiatement toutes les fonctionnalités (y compris le mode vocal) sans avoir besoin de clé d'API ni de ticket physique !
