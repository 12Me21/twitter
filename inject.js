document.open()
document.write("<body class='flex-row'><div id=$sidebar></div><div id=$main class='flex-grow'></div></body>")
document.close()

// you can add css files in manifest.json,
// but then would you need to reload the entire extension
// after modifiying the css files, for them to update.
for (let file of ['core.css', 'style.css']) {
	let link = document.createElement('link')
	link.rel = 'stylesheet'
	link.href = chrome.runtime.getURL('assets/'+file)
	document.head.appendChild(link)
}

// I inject script files rather than just running them directly
// because I want this to act like a normal website,
// rather than running all of its code as an extension.
for (let file of ['main.js']) {
	let script = document.createElement('script')
	script.src = chrome.runtime.getURL('assets/'+file)
	document.head.appendChild(script)
}
