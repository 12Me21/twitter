document.open()
document.write(`<p style='font-family: twemoji;'>⛹</p><p style='font-family: twitma;'></p`) // this is very important, otherwise the browser waits FOREVER before loading these fonts 
document.close()
console.log('🚪🚪🚪🚪🚪🚪🚪')

// you can add css files in manifest.json,
// but then would you need to reload the entire extension
// after modifiying the css files, for them to update.

// I inject script files rather than just running them directly
// because I want this to act like a normal website,
// rather than running all of its code as an extension.

function url(file) {
	return chrome.runtime.getURL('assets/'+file)
}

for (let file of ['core.css', 'style.css']) {
	let elem = document.createElement('link')
	elem.rel = 'stylesheet'
	elem.href = url(file)
	document.head.appendChild(elem)
}

for (let file of ['index.html', 'auth.js', 'query.js', 'draw.js', 'navigate.js', /*'twitter-text.js', 'editable.js'*/]) {
	let elem = document.createElement('script')
	elem.src = url(file)
	document.head.appendChild(elem)
}

let c = `line-height: 1; font-size: 20px; white-space: pre; background-image: url("${url('bg.png')}"); background-size: 300px; text-shadow: -2px -2px 0 #000, 2px -1px 0 #000, -1px 2px 0 #000, 1px 1px 0 #000; color: white;`
console.info("%c    THIS IS MY THE\n%c      \n%c MY WEBSITE NOW   ", c, c+"font-size: 60px; background-position: 0 -20px;", c+"background-position: 0 -80px;");
