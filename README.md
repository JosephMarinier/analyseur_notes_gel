Analyseur des notes provenant du site gel
==

### Installation
Télécharger les grilles de notes et de pondération sous les noms :
- files/S6 - notesEtu.html
- files/S6 - ponderation.html

Ou optionnellememt un fichier de notes par étudiant :
- files/_nom_ - S6 - notesEtu.html

### Exécution en ligne de commande
Inscrire la session à analyser :

> node notes 6

Optionnellement, pour afficher en liste hiérarchique à 1, 2 ou 3 niveaux (par défaut à "rowify") :

> node notes 6 3

Optionnellement, pour sélectionner un nom :

> node notes 6 rowify _nom_
