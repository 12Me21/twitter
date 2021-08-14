window.onload = function() {
	// delete all the fucking cookies
	document.cookie.split(';').forEach(function(c) {
		document.cookie = c.trim().split('=')[0] + '=;' + 'expires=Thu, 01 Jan 1970 00:00:00 UTC;';
	});
	console.log("heck")
	// 
	var x = location.pathname.substr(1)
	
	init().then(async ()=>{
		try {
			data = await get_user(x)
			draw_user(data.data.user.result.legacy)
		} catch {
			delete localStorage.tw2auth
		}
	})
	/*get_user(x.substr(1)).then(x=>{
		draw_user(x)
	})*/
}

