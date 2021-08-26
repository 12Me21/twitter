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
		$main.appendChild(elem)
	} else {
		let data = await auth.get_profile(x[0])
		console.log(data[1])
		draw_user(data[0])
		$profile_banner.hidden = false
		$profile_tweets.replaceChildren()
		if (data[1])
			$profile_tweets.append(draw_tweet(data[1]))
		for (let tweet of data[2]) {
			$profile_tweets.append(draw_tweet(tweet))
		}
	}
	/*get_user(x.substr(1)).then(x=>{
		draw_user(x)
	})*/
}
