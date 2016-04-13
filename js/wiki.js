var dictionary = "0123456789qwertyuiopasdfghjklzxcvbnm,.()'- ".split("");
var keys = {};
for (var i in dictionary) keys[dictionary[i]] = +i;
var charsRead = 0;
var maxChars = 400;
Net = null;
Wiki = {};

function init(){

	var network = localStorage.getItem("network") ? JSON.parse(localStorage.getItem("network")) : null;
	Net = network ? Network.fromJSON(network) : new Architect.LSTM(dictionary.length, parseInt(prompt("# Memory Blocks?", 60)) || 60, dictionary.length);
	Wiki.node = document.getElementById("wiki");
	Wiki.window = Wiki.node.contentWindow;
	Wiki.document = Wiki.node.contentDocument;
	Wiki.selection = Wiki.node.contentWindow.getSelection();
	Wiki.$ = $("#wiki");
	log("Building network...", "status");
	Wiki.worker = Net.worker();
	Wiki.links = {};
	Wiki.article = localStorage.getItem("article") || "/wiki/Synapse";
	Wiki.articles = localStorage.getItem("articles") ?  localStorage.getItem("articles").split("&") : [Wiki.article];
	Wiki.characters = localStorage.getItem("characters") ? +localStorage.getItem("characters") : 0;
	Wiki.currentParagraph = localStorage.getItem("currentParagraph") ? +localStorage.getItem("currentParagraph") : 0;;
	Wiki.currentWord = localStorage.getItem("currentWord") ? +localStorage.getItem("currentWord") : 0;
	Wiki.time = localStorage.getItem("time") ? +localStorage.getItem("time") : 0;
	Wiki.learningRate = localStorage.getItem("learningRate") ? +localStorage.getItem("learningRate") : 0.001;
	Wiki._stop = false;
	Wiki._skip = false;
	Wiki._loaded = true;

	var quantity = Neuron.quantity();
	log(quantity.neurons, "neurons");
	log(quantity.connections, "connections");
	log((Net.optimized.memory.length*8) + " bytes", "size");
	logTime();

	// MAX CHARS READ BEFORE REFRESHING THE PAGE
	maxChars = 500//(15000 / quantity.connections) * 400;

	$("#pause-button").click(function(){
		if (Wiki._stop)
		{
			Wiki.play();
		} else if (Wiki._loaded) {
			Wiki.pause();
		}
	});

	$("#export-button").click(function(){
		if (Wiki._stop)
		{
			Wiki.download();
		}
	});

	$("#load-button").click(function(){
		if (Wiki._stop)
		{
			Wiki.load(JSON.parse(prompt("JSON:")));
		}
	});

	Wiki.load = function(data){
		if (Wiki._stop){
			Wiki._loaded = false;
			$("#pause-button").css('opacity', .5);
			log("Loading...", "status");
			requestAnimationFrame(function(){
				Wiki.article = data.article;
				Wiki.articles = data.articles.split("&");
				Wiki.characters = +data.characters;
				Wiki.currentParagraph = data.currentParagraph;
				Wiki.currentWord = data.currentWord;
				Wiki.time = data.time;
				$("#pause-button").css('opacity', 1);
				log("Loaded!", "status");
				Wiki._loaded = true;
				Wiki.save(data.network);
			});
		} else {
			alert("You have to pause the network before you can load a new one!");
		}
	}

	Wiki.download = function (){
		
		if (Wiki._stop)
		{
			Wiki._loaded = false;
			$("#pause-button").css('opacity', .5);
			log("Exporting network...", "status");
			requestAnimationFrame(function(){
				var network = JSON.stringify(Net.toJSON());
				var json = '{ "article": "' + Wiki.article + 
							'", "articles": "' + Wiki.articles.join("&") + 
							'", "characters": ' + Wiki.characters + 
							', "time": ' + Wiki.time + 
							', "currentParagraph": ' + Wiki.currentParagraph +
							', "currentWord": ' + Wiki.currentWord + 
							', "network": ' + network + ' }';
				var blob = new Blob([json], {type: "text/plain;charset=utf-8"});
				saveAs(blob, "network.json");
				$("#pause-button").css('opacity', 1);
				log("Exported!", "status");
				Wiki._loaded = true;
			});
		} else {
			alert("You have to pause the network before you can export it!");
		}
	}

	Wiki.save = function(network, stop){
		Wiki.pause();
		setTimeout(function(){
			if (Wiki._stop)
			{
				Wiki._loaded = false;
				$("#pause-button").css('opacity', .5);
				log("Saving network...", "status");

				requestAnimationFrame(function(){

					localStorage.setItem("article", Wiki.article);
					localStorage.setItem("articles", Wiki.articles.join("&"));
					localStorage.setItem("characters", Wiki.characters.toString());
					localStorage.setItem("time", Wiki.time);
					localStorage.setItem("currentParagraph", Wiki.currentParagraph);
					localStorage.setItem("currentWord", Wiki.currentWord);
					localStorage.setItem("network",  JSON.stringify(network || Net.toJSON()));

					Wiki._loaded = true;
					$("#pause-button").css('opacity', 1);
					if (stop){
						log("Saved!", "status");
					} else {
						window.location.reload();
						log("Reloading...", "status");
					}
				});
			}
		}, 1000);
	}

	Wiki.pause = function(){
		Wiki._stop = true;
		$("#pause-button").html("PLAY");
		$("#export-button").css('opacity', 1);
		$("#load-button").css('opacity', 1);
		log("Paused...", "status");
	}

	Wiki.play = function(){
		Wiki._stop = false;
		$("#pause-button").html("PAUSE");
		$("#export-button").css('opacity', .5);
		$("#load-button").css('opacity', .5);
		log("Reading paragraph " + (Wiki.currentParagraph+1) + "/" + Wiki.p.length, "status");
		readParagraph();
	}

	Wiki.skip = function(){
		Wiki._skip = true;
	}

	Wiki.reset = function(){
		localStorage.clear(); 
		window.location.reload();
	}

	Wiki.setRate = function(rate){
		Wiki.learningRate = rate;
		localStorage.setItem("learningRate", rate);
	}

	Wiki.node.onload = function() {
	  readArticle();
	};

	loadArticle(Wiki.article);
}


function log(text, id) {
	$("#" + id + "-console").html(text);
}

function logTime(){
	var days = Wiki.time / 86400000 | 0;
	var hours = (Wiki.time / 3600000 | 0) % 24;
	var minutes = (Wiki.time / 60000 | 0) % 60;
	days = days > 0 ? days + "d " : "";
	hours = hours > 0 ? hours + "h " : "";
	minutes = minutes + "m";
	log(days + hours + minutes, "train-time");
}

function loadArticle(article, startFromBegining){
	Wiki.article = article;
	var alreadyRead = false;
	for (var i in Wiki.articles)
		if (article == Wiki.articles[i])
			alreadyRead = true;
	if (!alreadyRead)
		Wiki.articles.push(article);
	log(article , "article");
	log(Wiki.articles.length, "num-articles");
	log("Loading..." , "status");
	if (startFromBegining)
	{
		Wiki.currentParagraph = 0;
		Wiki.currentWord = 0;
	}
	loadURL("proxy.php?s=en.wikipedia.org" + article);
}

function loadURL (url) {
	Wiki.$.attr("src", url);
}

function readArticle(){
	log("Reading..." , "status");
	Wiki.links = {};
	$(Wiki.node.contentDocument.getElementsByTagName("sup")).remove();
	Wiki.p = Wiki.node.contentDocument.getElementsByTagName("p");
	getLinks();
	Wiki.play();
}

function getChar(array)
{
	var max = 0;
	var ind = 0;
	for (var i in array)
	{
		if (array[i] > max)
		{
			max = array[i];
			ind = i;
		}
	}
	return dictionary[ind];
}

function getLinks(){
	for (var p in Wiki.p)
	{
		var pp = Wiki.p[p];
		if (pp && pp.getElementsByTagName)
		{
			var a = pp.getElementsByTagName("a");
			for (var i in a)
			{
				var link = a[i].pathname;
				if (link && link.indexOf("php") == -1 && link.indexOf("template") == -1)
				{
					var name = a[i].title.split(" ")[0].toLowerCase();
					Wiki.links[name] = {
						article: link,
						error: Infinity
					}
				}
			}
		}
	}
}

function readParagraph(nth){

	if (typeof nth == "undefined")
		nth = Wiki.currentParagraph;
	else
		Wiki.currentParagraph = nth;

	if (nth >= Wiki.p.length)
	{
		nextArticle();
		return;
	}

	log("Reading paragraph " + (nth+1) + "/" + Wiki.p.length , "status");
	log(Wiki.characters , "num-chars");

	var sel = Wiki.node.contentWindow.getSelection();
	sel.selectAllChildren(Wiki.p[nth]);
	var paragraph = sel.toString()
	.toLowerCase()
	.replace(/à|á|â|ä|æ|ã|å|ā/g, "a")
	.replace(/è|é|ê|ë|ē|ė|ę/g, "e")
	.replace(/î|ï|í|ī|į|ì/g, "i")
	.replace(/ô|ö|ò|ó|œ|ø|ō|õ/g, "o")
	.replace(/û|ü|ù|ú|ū/g, "u")
	.replace(/\[|\{/g, "(")
	.replace(/\]|\}/g, ")")
	.replace(/_/g, "-")
	.replace(/"/g, "'");
	Wiki.words = paragraph.split(" ");

	readWord();
}

var index = 0;
var error = 0;
var numChars = 0;

function readWord(nth){

	if (Wiki._stop)
		return;

	if (Wiki._skip)
	{
		Wiki._skip = false;
		nextArticle();
		return;
	}

	if (charsRead > maxChars)
		return Wiki.save();

	if (typeof nth == "undefined")
		nth = Wiki.currentWord;
	else
		Wiki.currentWord = nth;

	if (nth >= Wiki.words.length)
	{
		readParagraph(Wiki.currentParagraph + 1);
		return;
	}

	var word = Wiki.words[nth] + " ";

	var length = dictionary.length;
	var chars = word.split("");
	
	var input = [];
	var target = [];
	for (var i = 0; i < length; i++)
		input[i] = 0;
	input[keys[" "]] = 1;

	var predictedWord = "";
	var success = 0;

	var sendMessage = function(action)
	{
		if (chars[index] in keys)
		{
			for (var j = 0; j < length; j++)
				target[j] = 0;
			target[keys[chars[index]]] = 1;

			Wiki.worker.postMessage({ 
				action: action,
				input: input,
				target: target,
				rate: Wiki.learningRate,
				memoryBuffer: Net.optimized.memory
			}, [Net.optimized.memory.buffer]);
		} else {
			index++;
			if (index < chars.length)
			{
				sendMessage(action);
			} else {
				index = 0;
				setTimeout(function(){
					readWord(nth + 1);
				}, 100);
			}
		}
	}

	var next = function(){
		index++;
		charsRead++;
		if (index >= chars.length)
		{
			index = 0;
			numChars = 0;
			word = word.trim();
			if (word in Wiki.links)
				Wiki.links[word].error = error;
			Wiki.characters += word.length;
			log(word, "target-word");
			log(predictedWord, "predicted-word");
			log(error, "synaptic-error");
			log(((1-success/(word.length+1))*100).toFixed(2) + "%", "prediction-error");
			log((Date.now() - start) + " ms", "elapsed-time");
			Wiki.time += Date.now() - start;
			logTime();
			readWord(nth + 1);
			error = 0;
		} else
			sendMessage('activate');
	}

	Wiki.worker.onmessage = function(e)
	{
		Net.optimized.memory = e.data.memoryBuffer;

		if (e.data.action == 'activate')
		{
			if (Wiki._stop)
				return;

			for (var j = 0; j < length; j++)
				input[j] = 0;
			input[keys[chars[index]]] = 1;

			var predict = e.data.output;

			var targetChar = getChar(target);
			var predictedChar = getChar(predict);
			predictedWord += predictedChar;
			if (targetChar == predictedChar)
				success++;

			var delta = 0
			for (var j = 0; j < length; j++)
				delta += Math.pow(target[j] - predict[j], 2);
			error += delta / length;
			numChars++;
			log(Wiki.characters + numChars, "num-chars");

			if (targetChar == predictedChar)
				next();
			else
				sendMessage("propagate");
		} else {
			next();
		}
	}
	var start = Date.now();
	sendMessage("activate");
}

function nextArticle(){
	log("Choosing next article..." , "status");
	var min = Infinity;
	var article = Wiki.articles[Math.random() * Wiki.articles.length | 0];
	for (var i in Wiki.links)
	{
		if (Wiki.links[i].error < min)
		{
			min = Wiki.links[i].error;
			article = Wiki.links[i].article;
		}
	}
	Wiki.pause();
	//Wiki.article = article;
	Wiki.currentParagraph = 0;
	Wiki.currentWord = 0;
	Wiki.save();
}

$(init);