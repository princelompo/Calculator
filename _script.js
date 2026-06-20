
(function () {
	const screen = document.getElementById('screen');
	const keys = document.querySelector('.keys');

	// Si les éléments DOM manquent, on arrête pour éviter des erreurs
	if (!screen || !keys) return;

	// expression courante (chaîne construite par l'utilisateur)
	let expr = '';
	// indique si la dernière action a produit un résultat (appuyer sur '=')
	let lastWasResult = false;

	// Détecte si un caractère est un opérateur arithmétique
	const isOperator = (ch) => ['+', '-', '*', '/'].includes(ch);

	// Met à jour l'affichage (écran)
	function updateScreen() {
		screen.textContent = expr === '' ? '0' : expr;
	}

	// Ajoute un chiffre, un point ou un opérateur à l'expression
	function appendValue(val) {
		if (!val) return;

		// Si l'écran montre une erreur, n'autoriser que le démarrage d'une nouvelle saisie par un chiffre ou '.'
		if (expr === 'Error') {
			if (/^\d$/.test(val) || val === '.') {
				expr = '';
				lastWasResult = false;
				// on continue normalement pour ajouter la valeur
			} else {
				return; // ignorer autres entrées
			}
		}

		// Si le dernier affichage était un résultat et que l'utilisateur tape un chiffre ou '.',
		// on doit remplacer l'affichage par une nouvelle saisie (commencer à zéro)
		if (lastWasResult && (/^\d$/.test(val) || val === '.')) {
			expr = '';
			lastWasResult = false;
		}

		// point décimal
		if (val === '.') {
			// empêcher plusieurs points dans le même nombre
			// considérer '(' comme séparateur de nombre également
			const lastOp = Math.max(expr.lastIndexOf('+'), expr.lastIndexOf('-'), expr.lastIndexOf('*'), expr.lastIndexOf('/'), expr.lastIndexOf('('));
			const currentNumber = expr.slice(lastOp + 1);
			if (currentNumber.includes('.')) return;
			if (currentNumber === '') {
				// commencer un décimal par '0.' si l'utilisateur tape '.' en premier
				expr += '0.';
				updateScreen();
				return;
			}
			expr += '.';
			updateScreen();
			return;
		}

		// chiffre
		if (/\d/.test(val)) {
			if (expr === '0') expr = val;
			else expr += val;
			lastWasResult = false;
			updateScreen();
			return;
		}

		// parenthèses
		if (val === '(') {
			// si le caractère précédent est un chiffre ou ')' on insère une multiplication implicite
			const last = expr.slice(-1);
			if (last && (/\d/.test(last) || last === ')')) {
				expr += '*(';
			} else {
				expr += '(';
			}
			updateScreen();
			return;
		}

		if (val === ')') {
			// n'ajouter une ')' que s'il existe une '(' non fermée et que ça ne suit pas un opérateur
			const open = (expr.match(/\(/g) || []).length;
			const close = (expr.match(/\)/g) || []).length;
			const last = expr.slice(-1);
			if (open > close && last !== '' && !isOperator(last) && last !== '(') {
				expr += ')';
				updateScreen();
			}
			return;
		}

		// opérateur
		if (isOperator(val)) {
			if (expr === '') {
				// n'autoriser que le signe '-' en début pour un nombre négatif
				if (val === '-') {
					expr = '-';
					updateScreen();
				}
				return;
			}
			const lastChar = expr.slice(-1);
			if (isOperator(lastChar)) {
				// remplacer l'opérateur final par le nouvel opérateur (évite '+*')
				expr = expr.slice(0, -1) + val;
			} else {
				expr += val;
			}
			lastWasResult = false;
			updateScreen();
			return;
		}
	}

	// Efface tout
	function clearAll() {
		expr = '';
		lastWasResult = false;
		updateScreen();
	}

	// Supprime le dernier caractère (backspace)
	function backspace() {
		if (expr.length === 0) return updateScreen();
		// si l'écran affiche un résultat complet et l'utilisateur appuie backspace,
		// on revient à l'état de saisie en supprimant le dernier caractère du résultat
		if (lastWasResult) {
			expr = expr.slice(0, -1);
			lastWasResult = false;
			updateScreen();
			return;
		}
		expr = expr.slice(0, -1);
		updateScreen();
	}

	// Applique le pourcentage au dernier nombre saisi
	// Exemple: '50+10' puis '%' -> '50+0.1'
	function applyPercent() {
		if (expr === '') return;
		const lastOp = Math.max(expr.lastIndexOf('+'), expr.lastIndexOf('-'), expr.lastIndexOf('*'), expr.lastIndexOf('/'));
		const numStr = expr.slice(lastOp + 1);
		if (numStr === '') return; // rien à convertir
		const n = parseFloat(numStr);
		if (isNaN(n)) return;
		const replaced = (n / 100).toString();
		expr = expr.slice(0, lastOp + 1) + replaced;
		lastWasResult = false;
		updateScreen();
	}

	// Évalue l'expression de façon contrôlée et place le résultat dans 'expr'
	function evaluateExpression() {
		if (expr === '') return;
		// Si l'expression se termine par un opérateur, on le retire
		if (isOperator(expr.slice(-1))) {
			expr = expr.slice(0, -1);
		}

		// Validation simple : n'autoriser que les chiffres, opérateurs, parenthèses et points
		// Cela réduit le risque d'évaluer du code arbitraire
		const safeRe = /^[0-9+\-*/().\s]+$/;
		if (!safeRe.test(expr)) {
			expr = 'Error';
			updateScreen();
			return;
		}

		try {
			// Utiliser Function pour évaluer l'expression (plus sûr que eval dans certains contextes)
			// On restaure ensuite le résultat sous forme de chaîne
			// Limiter la précision pour éviter les longueurs inutiles
			// eslint-disable-next-line no-new-func
			const result = Function('return (' + expr + ')')();
			if (typeof result === 'number' && isFinite(result)) {
				// arrondir à 12 décimales maximum et supprimer les zéros inutiles
			  	const rounded = Math.round((result + Number.EPSILON) * 1e12) / 1e12;
				expr = String(rounded);
				lastWasResult = true;
			} else {
				expr = 'Error';
				lastWasResult = false;
			}
		} catch (err) {
				expr = 'Error';
				lastWasResult = false;
		}
		updateScreen();
	}

		// Évalue l'expression et renvoie un nombre (ou lance une exception en cas d'erreur)
		function numericEvaluate(rawExpr) {
			if (!rawExpr) throw new Error('expression vide');
			// retirer opérateur terminal
			let e = rawExpr;
			if (isOperator(e.slice(-1))) e = e.slice(0, -1);
			// remplacer l'opérateur d'exposant affiché '^' par '**' pour JS
			e = e.replace(/\^/g, '**');
			// validation simple : permettre chiffres, opérateurs, parenthèses et espaces
			const safeRe = /^[0-9+\-*/().\s]+$/;
			if (!safeRe.test(e)) throw new Error('unsafe expression');
			// eslint-disable-next-line no-new-func
			const val = Function('return (' + e + ')')();
			if (typeof val !== 'number' || !isFinite(val)) throw new Error('invalid result');
			return val;
		}

		// Met à jour 'expr' à partir d'un nombre en arrondissant proprement
		function setExprFromNumber(num) {
			const rounded = Math.round((num + Number.EPSILON) * 1e12) / 1e12;
			expr = String(rounded);
			lastWasResult = true;
			updateScreen();
		}

		// Applique une fonction mathématique uniaire au résultat courant
		// name : 'sqrt' | 'sin' | 'cos' | 'tan' | 'log'
		function applyUnary(name) {
			try {
				const val = numericEvaluate(expr);
				let out;
				switch (name) {
					case 'sqrt':
						out = Math.sqrt(val);
						break;
					case 'sin':
						// on interprète l'angle en degrés (plus convivial pour un usage général)
						out = Math.sin((val * Math.PI) / 180);
						break;
					case 'cos':
						out = Math.cos((val * Math.PI) / 180);
						break;
					case 'tan':
						out = Math.tan((val * Math.PI) / 180);
						break;
					case 'log':
						// log base 10
						out = Math.log10(val);
						break;
					default:
						throw new Error('fonction inconnue');
				}
				if (typeof out !== 'number' || !isFinite(out)) throw new Error('resultat invalide');
				setExprFromNumber(out);
			} catch (err) {
				expr = 'Error';
				updateScreen();
			}
		}

		// Gère le bouton xʸ : on insère l'opérateur '^' visible (sera transformé en '**' à l'évaluation)
		function applyPow() {
			if (expr === '') return;
			const lastChar = expr.slice(-1);
			if (isOperator(lastChar) || lastChar === '^') return;
			expr += '^';
			lastWasResult = false;
			updateScreen();
		}

	// Délégation des clics sur les boutons
	keys.addEventListener('click', (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const val = btn.getAttribute('data-value');
		const action = btn.getAttribute('data-action');

		if (val) {
			appendValue(val);
			return;
		}
			if (action) {
				if (action === 'clear') return clearAll();
				if (action === 'back') return backspace();
				if (action === 'percent') return applyPercent();
				if (action === 'equals') return evaluateExpression();
				if (action === 'pow') return applyPow();
				if (action === 'sqrt') return applyUnary('sqrt');
				if (action === 'sin') return applyUnary('sin');
				if (action === 'cos') return applyUnary('cos');
				if (action === 'tan') return applyUnary('tan');
				if (action === 'log') return applyUnary('log');
				// autres actions avancées pourront être ajoutées ultérieurement
			}
	});

	// --- Support clavier : permet de contrôler la calculatrice avec le clavier physique ---
	// Raccourcis acceptés (en minuscule ou majuscule) :
	// chiffres 0-9, '.' ; opérateurs + - * / ; 'x' ou 'X' = * ; '^' pour puissance
	// Enter ou '=' -> évaluer ; Backspace -> effacer un caractère ; Delete -> clear
	// '%' -> pourcentage ; r -> sqrt (racine), s -> sin, c -> cos, t -> tan, l -> log
	window.addEventListener('keydown', (ev) => {
		const k = ev.key;
		// chiffres
		if (/^\d$/.test(k)) { appendValue(k); ev.preventDefault(); return; }
		if (k === '.') { appendValue('.'); ev.preventDefault(); return; }
		// opérateurs
		if (k === '+' || k === '-' || k === '*' || k === '/') { appendValue(k); ev.preventDefault(); return; }
		if (k === 'x' || k === 'X') { appendValue('*'); ev.preventDefault(); return; }
		if (k === '^') { applyPow(); ev.preventDefault(); return; }
		// actions
		if (k === 'Enter' || k === '=') { evaluateExpression(); ev.preventDefault(); return; }
		if (k === 'Backspace') { backspace(); ev.preventDefault(); return; }
		if (k === 'Delete') { clearAll(); ev.preventDefault(); return; }
		if (k === '%') { applyPercent(); ev.preventDefault(); return; }
		// fonctions rapides par lettre
		const kl = k.toLowerCase();
		if (kl === 'r') { applyUnary('sqrt'); ev.preventDefault(); return; } // r = racine
		if (kl === 's') { applyUnary('sin'); ev.preventDefault(); return; }
		if (kl === 'c') { applyUnary('cos'); ev.preventDefault(); return; }
		if (kl === 't') { applyUnary('tan'); ev.preventDefault(); return; }
		if (kl === 'l') { applyUnary('log'); ev.preventDefault(); return; }
	});

	// initialisation de l'affichage
	updateScreen();
})();

