let bearer, querys, token

async function init() {
	if (localStorage.tw2auth) {
		;({bearer, querys, token} = JSON.parse(localStorage.tw2auth))
		return
	}
	let text = await (await fetch("https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js")).text();
	bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
	querys = {}
	text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
		let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
		querys[d.operationName] = d
	})
	token = (await (await fetch("https://api.twitter.com/1.1/guest/activate.json", {method:"POST",headers: {authorization: "Bearer "+bearer,}})).json()).guest_token
	localStorage.tw2auth = JSON.stringify({bearer, querys, token})
}

function graphql_url(type, params) {
	let q = querys[type]
	return `https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}?variables=${encodeURIComponent(JSON.stringify(params))}`
}

async function get_user(name) {
	let url = graphql_url('UserByScreenName',{screen_name: name, withSafetyModeUserFields: false, withSuperFollowsUserFields: false})
	let resp = await fetch(url, {
		headers: {
			Authorization: "Bearer "+bearer,
			'x-guest-token': token,
		},
	})
	return await resp.json()
}
