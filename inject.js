document.open()
document.close()

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

for (let file of ['index.html', 'api.js', 'draw.js', 'main.js']) {
	let elem = document.createElement('script')
	elem.src = url(file)
	document.head.appendChild(elem)
}
