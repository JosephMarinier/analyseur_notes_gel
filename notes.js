var async = require("async");
var fs = require("fs");
var https = require("https");
var jsdom = require("jsdom");
var _ = require("underscore");

var {rowify} = require("./stringUtils");

function lire(file, callback) {
	fs.readFile(file, "utf8", function (error, body) {
		if (error) {
			callback(error);
			return;
		}
		
		jsdom.env(body, function (error, window) {
			if (error) {
				callback(error);
				return;
			}
			
			var script = window.document.getElementsByTagName("script")[3].textContent;
			var json = /var dataToolTip = (\[.*?\]);/.exec(script);
			if (!json) {
				json = /var data = (\[.*?\]);/.exec(script);
			}
			var lignes = JSON.parse(json[1]);
			
			var trs = _(window.document.getElementsByClassName("dojoxGridRow")).toArray();
			trs.pop();
			var colonnes = [];
			var évaluations = [];
			_(trs).each(function (tr, ligne) {
				évaluation = tr.getElementsByTagName("td")[0].innerHTML;
				if (_(évaluations).contains(évaluation)) {
					évaluation += " 2";
				}
				évaluations.push(évaluation);
				
				_(lignes[ligne]).each(function (td, colonne) {
					if (td && !/^--$/.test(td) && !/^--$/.test(td.note)) {
						if (!_(colonnes).has(colonne)) {
							colonnes[colonne] = Object.create(null);
						}
						colonnes[colonne][évaluation] = td;
					}
				});
			});
			
			
			var headers = window.document.getElementsByClassName("dojoxGridHeader")[0];
			
			var trs = headers.getElementsByTagName("tr");
			
			var ths = trs[1].getElementsByTagName("th");
			
			var index = 0;
			var APs = _(ths).map(function (th) {
				var nb_compétences = th.getAttribute("colspan") || 1;
				
				var div = th.getElementsByTagName("div")[0];
				var code = div.innerHTML;
				
				var AP = Object.create(null);
				
				AP.code = code;
				
				var compétences = colonnes.splice(0, nb_compétences);
				
				if (!_(compétences).isEmpty()) {
					AP.compétences = compétences;
				}
				
				return AP;
			});
			
			callback(undefined, APs);
		});
	})
}

function code2name(code, callback) {
	https.get({
		host: "www.usherbrooke.ca",
		path: "/fiches-cours/" + code
	}, function (response) {
		var body = "";
		response.on("data", function (chunk) {
			body += chunk;
		});
		response.on("end", function () {
			jsdom.env(body, function (error, window) {
				if (error) {
					callback(error);
					return;
				}
			 
				//var $ = require("jquery")(window);
				//callback(undefined, $("h1").text());
				callback(undefined, window.document.getElementsByTagName("h1")[0] && window.document.getElementsByTagName("h1")[0].innerHTML);
			});
		});
	}).on("error", function (error) {
		callback(error);
	});
}

// callback(error, APs)
function trol(session, nom, callback) {
	lire("files/" + _([nom, "S" + session, "notesEtu.html"]).compact().join(" - "), function (error, notes) {
		if (error) {
			console.error(error);
			return;
		}
		lire("files/" + ["S" + session, "ponderation.html"].join(" - "), function (error, pondération) {
			if (error) {
				console.error(error);
				return;
			}
			//console.log(JSON.stringify(notes, null, 4));
			//console.log(JSON.stringify(pondération, null, 4));
			async.map(_(pondération).pluck("code"), code2name, function (err, noms) {
				if (err) {
					console.error("code2name");
					console.error(err);
				}
				
				const total = {
					M: 0,
					Z: 0,
					P: 0,
					D: 0,
				};
				
				const APs = _(pondération).map(function (AP, i) {
					AP.nom = noms[i];
					AP.total = {
						note: 0,
						moyenne: 0,
						variance: 0,
						ponderation: 0,
						absolu: 0
					};
					AP.compétences = _(AP.compétences).map(function (compétence, j) {
						var total = {
							note: 0,
							moyenne: 0,
							variance: 0,
							ponderation: 0,
							absolu: 0
						};
						var lol = _(compétence).mapObject(function (ponderation, évaluation) {
							var temp = Object.create(null);
							temp.ponderation = Number(ponderation);
							if (notes[i].compétences && notes[i].compétences[j] && notes[i].compétences[j][évaluation]) {
								temp.note = Number(notes[i].compétences[j][évaluation].note);
								temp.moyenne = Number(notes[i].compétences[j][évaluation].moyenne);
								temp.variance = Math.pow(Number(notes[i].compétences[j][évaluation].ecartType), 2);
								total.note += temp.note;
								total.moyenne += temp.moyenne;
								total.variance += temp.variance;
								total.ponderation += temp.ponderation;
							}
							total.absolu += temp.ponderation;
							return temp;
						});
						
						AP.total.note += total.note;
						AP.total.moyenne += total.moyenne;
						AP.total.variance += total.variance;
						AP.total.ponderation += total.ponderation;
						AP.total.absolu += total.absolu;
						lol.total = total;
						return lol;
					});
					
					total.M += AP.total.note;
					total.Z += cote(AP.total.note, AP.total.ponderation) * AP.total.absolu;
					total.P += AP.total.ponderation
					total.D += AP.total.absolu;
					
					return AP;
				});
				
				callback(null, {
					APs: APs,
					total: total,
				});
			});
		});
	});
}

function note(temp) {
	var string = fraction(temp.note, temp.ponderation);
	if (temp.note) {
		string += " = " + pourcentage(temp.note, temp.ponderation) + " % = " + lettre(temp.note, temp.ponderation)
			+ " [" + fraction(temp.moyenne, temp.ponderation) + " = " + pourcentage(temp.moyenne, temp.ponderation) + " % = " + lettre(temp.moyenne, temp.ponderation)
			+ " -> " + pourcentage(temp.note - temp.moyenne, temp.ponderation) + " %]";
		if (temp.absolu && temp.ponderation < temp.absolu) {
			string += " | " + fraction(temp.note, temp.absolu) + " = " + pourcentage(temp.note, temp.absolu) + " %";
			var restant = temp.absolu - temp.ponderation;
			var objectif = 0.85 * temp.absolu - temp.note;
			string += " | " + fraction(objectif, restant) + " = " + pourcentage(objectif, restant) + " %";
		}
	}
	return string;
}

function arrondi(note) {
	return Math.round(note*100)/100;
}

function fraction(note, ponderation) {
	return arrondi(note) + "/" + arrondi(ponderation);
}

function pourcentage(note, ponderation) {
	return Math.round(note*10000/ponderation)/100;
}

function rang(note, ponderation) {
	var note = pourcentage(note, ponderation);
	
	var mins = [0, 50, 53, 57, 60, 64, 68, 71, 75, 78, 81, 85];
	
	return _(mins).findLastIndex(function (seuil) {
		return note >= seuil;
	});
}

function lettre(note, ponderation) {
	var lettres = ['E',	 'D',  'D+', 'C-', 'C',	 'C+', 'B-', 'B',  'B+', 'A-', 'A',	 'A+'];
	
	return lettres[rang(note, ponderation)];
}

function cote(note, ponderation) {
	var cotes =	  [0,	 1,	   1.3,	 1.7,  2,	 2.3,  2.7,	 3,	   3.3,	 3.7,  4,	 4.3];
	
	return cotes[rang(note, ponderation)];
}

function main() {
	var session = process.argv[process.execArgv.length + 2];
	var niveau = process.argv[process.execArgv.length + 3] || "rowify";
	var nom = process.argv[process.execArgv.length + 4];

	trol(session, nom, function (error, {APs, total: {M, Z, P, D}}) {
		if (niveau === "rowify") {
			const lignes = [...APs.map(function ({code, nom, total: {note, moyenne, variance, ponderation, absolu}}) {
				var ligne = {
					AP: {
						code: code,
						titre: nom,
						cr: absolu / 300,
					},
					"note / corrigé": {
						note: fraction(note, ponderation),
					},
				};
				
				
				if (note) {
					ligne["note / corrigé"]["%"] = pourcentage(note, ponderation) + "%";
					ligne["note / corrigé"][""] = lettre(note, ponderation);
					
					let écart_type = Math.sqrt(variance);
					ligne["moyenne / corrigé"] = {
						note: fraction(moyenne, ponderation),
						"%": pourcentage(moyenne, ponderation) + "%",
						"": lettre(moyenne, ponderation),
						"σ": pourcentage(écart_type, ponderation) + "%",
						"Δ": pourcentage(note - moyenne, ponderation) + "%",
						"Δ/σ": arrondi((note - moyenne) / écart_type),
					};
					
					if (absolu && ponderation < absolu) {
						ligne["note / total"] = {
							note: fraction(note, absolu),
							"%": pourcentage(note, absolu) + "%",
						};
						
						var restant = absolu - ponderation;
						var objectif = 0.85 * absolu - note;
						ligne["objectif A+"] = {
							note: fraction(objectif, restant),
							"%": pourcentage(objectif, restant) + "%",
						};
					}
				}
				return ligne;
			}), {
				AP: {
					code: "total",
				},
				"note / corrigé": {
					note: fraction(M, P),
					"%": pourcentage(M, P),
					"": arrondi(Z/D),
				}
			}];
			
			console.log();
			console.log(rowify(lignes, {
				delimiters: [" | ", " : ", " "]
			}));
			console.log();
		} else if (niveau === 0) {
			console.log(_(APs).map(function (AP) {
				return AP.code + _(AP.compétences).map(function () {
					return ";";
				}).join("");
			}).join(""));
			//console.log(_(APs).pluck("nom").join(";"));
			console.log(_(APs).map(function (AP) {
				return AP.nom + _(AP.compétences).map(function () {
					return ";";
				}).join("");
			}).join(""));
			console.log(_(APs).reduce(function (memo, AP) {
				return _(AP.compétences).reduce(function (memo, compétence, j) {
					memo.push(j + 1);
					return memo;
				}, memo);
			}, []).join(";"));
		} else {
			_(APs).each(function (AP, i) {
				console.log();
				console.log(AP.code + " - " + AP.nom);
				
				_(AP.compétences).each(function (compétence, j) {
					if (niveau > 1) {
						console.log("  compétence " + (j + 1));
						
						_(compétence).each(function (temp, évaluation) {
							if (temp.note) {
								if (niveau > 2) {
									console.log("	 " + évaluation + " : " + note(temp));
								}
							}
						});
						
						console.log("  Total : " + note(compétence.total));
					}
				});
				
				console.log("Total : " + note(AP.total));
			});
			
			console.log();
			console.log(fraction(Z, D) + " = " + arrondi(Z/D));
			console.log(fraction(M, P) + " = " + pourcentage(M, P) + " % | " + fraction(M, D) + " = " + pourcentage(M, D) + " %");
		}
	});
}
main();
