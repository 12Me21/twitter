window.onload = async function() {
	// delete all the fucking cookies
	document.cookie.split(';').forEach(function(c) {
		document.cookie = c.trim().split('=')[0] + '=;' + 'expires=Thu, 01 Jan 1970 00:00:00 UTC;';
	});
	//
	let auth = new Auth();
	await auth.log_in()
	var x = location.pathname.substr(1).split("/")
	if (x[1]=='status') {
		let data = await auth.get_tweet(x[2])
		let elem = draw_tweet(data)
		$main_scroll.appendChild(elem)
	} else {
		let data = await auth.get_profile(x[0])
		$main_scroll.append(draw_user(data[0]))
		if (data[1])
			$main_scroll.append(draw_tweet(data[1]))
		for (let tweet of data[2]) {
			$main_scroll.append(draw_tweet(tweet))
		}
	}
	/*get_user(x.substr(1)).then(x=>{
		draw_user(x)
	})*/
}
