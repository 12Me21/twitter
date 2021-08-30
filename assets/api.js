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
				'x-12-cookie': `_twitter_sess=${this.cookies._twitter_sess}; auth_token=${this.cookies.auth_token}; ct0=${this.cookies.ct0}`,
				//'x-guest-token': this.token,
			}
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	async get_tweet(id) {
		let data = await this.get_graphql('TweetDetail', {
			focalTweetId: id,
			// all of these fields are required and none of them are really important
			with_rux_injections: false, withCommunity: false, withBirdwatchNotes: false, withTweetQuoteCount: true, includePromotedContent: false, withSuperFollowsUserFields: false, withUserResults: true, withBirdwatchPivots: false, withReactionsMetadata: false, withReactionsPerspective: false, withSuperFollowsTweetFields: false, withVoice: false,
		})
		if (!data.threaded_conversation_with_injections)
			return null
		data = data.threaded_conversation_with_injections.instructions[0].entries.find(x => x.entryId==`tweet-${id}`).content.itemContent.tweet_results.result
		return data
	}
	
	async get_user(name) {
		let resp = await this.get_graphql('UserByScreenName', {
			screen_name: name,
			withSafetyModeUserFields: false, withSuperFollowsUserFields: false,
		})
		if (resp.user)
			return resp.user.result
		else
			return null
	}
	
	async get_profile(user_id) {
		// yes all these fields are REQUIRED
		let resp = await this.get_graphql('UserTweets', {userId: user_id, count:20, withTweetQuoteCount:true,includePromotedContent:false,withSuperFollowsUserFields:false,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:false,withReactionsPerspective:false,withSuperFollowsTweetFields:false,withVoice:true})
		let instructions = resp.user.result.timeline.timeline.instructions
		let tweets = instructions.find(x=>x.type=='TimelineAddEntries').entries
		let pinned = instructions.find(x=>x.type=='TimelinePinEntry')
		if (pinned)
			pinned = pinned.entry.content.itemContent.tweet_results.result
		return [pinned, tweets.filter(x=>/^tweet-/.test(x.entryId)).map(x=>x.content.itemContent.tweet_results.result)]
	}
	
	////////////////////////////////
	// Authentication/Login stuff //
	////////////////////////////////
	
	// this downloads a javascript file and extracts some values from it
	async get_secrets() {
		console.info("fetching secrets")
		// awful hack.
		let text = await fetch("https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js").then(x=>x.text())
		this.bearer = text.match(/a="Web-12",s="(.*?)"/)[1]
		this.querys = {}
		text.match(/\{queryId:".*?",operationName:".*?",operationType:".*?"\}/g).forEach(x=>{
			let d = JSON.parse(x.replace(/(\w+):/g,'"$1":'))
			this.querys[d.operationName] = d
		})
	}
	// get a guest token
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
		this.cookies = this.get_cookies()
		this.csrf_token = this.cookies.ct0
		try {
			let j = JSON.parse(localStorage.tw2secrets)
			this.bearer = j.bearer
			this.querys = j.querys
			console.info("using cached secrets")
		} catch {
			await this.get_secrets()
			localStorage.tw2secrets = JSON.stringify({bearer: this.bearer, querys: this.querys})
		}
		//await this.get_token()
	}
}
