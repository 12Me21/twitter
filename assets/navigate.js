let auth;

async function ready() {
	auth = new Auth();
	await auth.log_in()
	render(window.location)
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready)
else
	ready()

async function render(url) {
	url = new URL(url)
	let path = url.pathname.substr(1).split("/")
	$main_scroll.replaceChildren()
	if (path[1]=='status') {
		let data = await auth.get_tweet(path[2])
		let elem = draw_tweet(data)
		$main_scroll.appendChild(elem)
	} else if (path.length==1) {
		let username = path[0]
		if (username[0]=="@")
			username=username.substr(1)
		let data = await auth.get_profile(username)
		$main_scroll.append(draw_user(data[0]))
		if (data[1])
			$main_scroll.append(draw_tweet(data[1]))
		for (let tweet of data[2]) {
			$main_scroll.append(draw_tweet(tweet))
		}
	}
}
