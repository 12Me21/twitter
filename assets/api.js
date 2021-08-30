let bearer, querys, token

class Auth {
	constructor() {
		this.bearer = null
		this.querys = {}
		this.token = null
	}
	
	get_cookies() {
		let cookies = {}
		for (let item of document.cookie.split(";")) {
			let match = item.match(/^\s*([^]*?)="?([^]*?)"?\s*$/)
			if (match)
				cookies[match[1]] = decodeURIComponent(match[2])
		}
		return cookies
	}
	
	graphql_url(type, params) {
		let q = this.querys[type]
		return `https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}?variables=${encodeURIComponent(JSON.stringify(params))}`
	}
	async get_graphql(type, params) {
		let url = this.graphql_url(type, params)
		return fetch(url, {
			headers: {
				'Authorization': "Bearer "+this.bearer,
				'x-csrf-token': this.csrf_token,
				//'x-guest-token': this.token,
			}
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	async get_tweet(id) {
		let data = await this.get_graphql('TweetDetail', {
			focalTweetId: id,
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withTweetQuoteCount: true,
			includePromotedContent: false,
			withSuperFollowsUserFields: false,
			withUserResults: true,
			withBirdwatchPivots: false,
			withReactionsMetadata: false,
			withReactionsPerspective: false,
			withSuperFollowsTweetFields: false,
			withVoice: false,
		})
		data = data.threaded_conversation_with_injections.instructions[0].entries.find(x=>x.entryId==`tweet-${id}`).content.itemContent.tweet_results.result
		return data
	}
	
	async get_user(name) {
		let resp = await this.get_graphql('UserByScreenName', {
			screen_name: name,
			withSafetyModeUserFields: false,
			withSuperFollowsUserFields: false,
		})
		return resp.user.result
	}
	
	async get_profile(name) {
		let user = await this.get_user(name)
		// yes all these fields are REQUIRED
		let resp = await this.get_graphql('UserTweets', {userId:user.rest_id, count:20, withTweetQuoteCount:true,includePromotedContent:false,withSuperFollowsUserFields:false,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:false,withReactionsPerspective:false,withSuperFollowsTweetFields:false,withVoice:true})
		let instructions = resp.user.result.timeline.timeline.instructions
		let tweets = instructions.find(x=>x.type=='TimelineAddEntries').entries
		let pinned = instructions.find(x=>x.type=='TimelinePinEntry')
		if (pinned)
			pinned = pinned.entry.content.itemContent.tweet_results.result
		return [user.legacy, pinned, tweets.filter(x=>/^tweet-/.test(x.entryId)).map(x=>x.content.itemContent.tweet_results.result)]
	}
	// auth stuff
	async get_secrets() {
		try {
			let j = JSON.parse(localStorage.tw2secrets)
			this.bearer = j.bearer
			this.querys = j.querys
			console.info("using cached secrets")
		} catch {
			console.info("fetching secrets")
			// this is an awful hack. we need to extract some values from a js file without executing it
			let text = await fetch("https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js").then(x=>x.text())
			this.bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
			this.querys = {}
			text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
				let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
				this.querys[d.operationName] = d
			})
			localStorage.tw2secrets = JSON.stringify({bearer: this.bearer, querys: this.querys})
		}
	}
	
	async get_token() {
		let j = localStorage.tw2token
		if (0 && j) {
			console.info("using cached token")
			this.token = j
		} else {
			console.info("fetching token")
			await fetch(
				"https://api.twitter.com/1.1/guest/activate.json",
				{method: "POST", headers: {authorization: "Bearer "+this.bearer}}
			).then(x=>x.json()).then(x=>{
				this.token = x.guest_token
				localStorage.tw2token = this.token
			})
		}
	}
	
	async log_in() {
		console.info("logging in...")
		let cookies = this.get_cookies()
		this.csrf_token = cookies.ct0
		await this.get_secrets()
		//await this.get_token()
	}
}
