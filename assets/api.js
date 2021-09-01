let query_junk = {
	withTweetQuoteCount: true,
	includePromotedContent: false,
	withReactionsMetadata: true,
	withReactionsPerspective: true,
	withBirdwatchPivots: true,
	withSuperFollowsUserFields: true,
	withSuperFollowsTweetFields: true,
	withUserResults: true,
}
	
function encode_url_params(params) {
	let items = []
	for (let key in params) {
		items.push(encodeURIComponent(key)+'='+encodeURIComponent(params[key]))
	}
	if (items.length)
		return "?"+items.join("&")
	return ""
}

class Auth {
	bearer = null
	querys = {}
	cookies = {}
	guest = null
	guest_token = null
	
	constructor() {
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
	
	auth_headers() {
		if (this.guest) {
			return {
				'Authorization': "Bearer "+this.bearer,
				'x-guest-token': this.guest_token,
			}
		} else {
			return {
				// The bearer token is the same for all users and guests
				// it's extracted from: https://abs.twimg.com/responsive-web/client-web/main.91699ca5.js
				'Authorization': "Bearer "+this.bearer,
				// `x-csrf-token` must match the `ct0` cookie
				'x-csrf-token': this.cookies.ct0,
				// this header will be turned into a real cookie header by the browser extension
				'x-12-cookie': `_twitter_sess=${this.cookies._twitter_sess}; auth_token=${this.cookies.auth_token}; ct0=${this.cookies.ct0}`,
			}
		}
	}
	
	async get_graphql(type, params) {
		let q = this.querys[type]
		return fetch(`https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}?variables=${encodeURIComponent(JSON.stringify(params))}`, {
			headers: this.auth_headers()
		}).then(x=>x.json()).then(x=>x.data)
	}
	async post_graphql(type, params, body) {
		let q = this.querys[type]
		return fetch(`https://twitter.com/i/api/graphql/${q.queryId}/${q.operationName}`, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json;charset=UTF-8",
				...this.auth_headers(),
			},
			body: JSON.stringify({variables: JSON.stringify(params), queryId: q.queryId}), // god you can't make this shit up
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	async get_more_replies(tweet_id, cursor) {
		let data = await this.get_graphql('TweetDetail', {
			focalTweetId: tweet_id,
			cursor: cursor,
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withVoice: false,
			...query_junk,
		})
		return data
	}
	
	async get_tweet(id) {
		let data = await this.get_graphql('TweetDetail', {
			focalTweetId: id,
			// ugh all of these fields are required and none of them are really important
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withVoice: false,
			...query_junk,
		})
		return data
	}
	
	async get_user(name) {
		let resp = await this.get_graphql('UserByScreenName', {
			screen_name: name,
			withSafetyModeUserFields: false,
			withSuperFollowsUserFields: false,
		})
		if (resp.user)
			return resp.user.result
		else
			return null
	}
	
	async get_bookmarks(cursor) {
		let resp = await this.get_graphql('Bookmarks', {
			count: 20,
			cursor: cursor,
			withHighlightedLabel: false,
			...query_junk,
		})
		return resp.bookmark_timeline.timeline
	}
	
	async get_profile(user_id) {
		// yes all these fields are REQUIRED
		let resp = await this.get_graphql('UserTweets', {
			userId: user_id,
			count:20,
			withVoice: true,
			...query_junk,
		})
		if (resp.user.result.__typename=='User') {
			let instructions = resp.user.result.timeline.timeline
			return instructions
		}
		return null
	}
	
	async translate_tweet(id) {
		let json = await fetch(`https://twitter.com/i/api/1.1/strato/column/None/tweetId=${id},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`, {
			headers: this.auth_headers()
		}).then(x=>x.json())
		return json
	}
	
	async create_tweet(text, source) {
		let resp = await this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			dark_request: false,
			semantic_annotation_ids:[],
			withReactionsMetadata:false,
			withReactionsPerspective:false,
			withSuperFollowsTweetFields:false,
			withSuperFollowsUserFields:false,
			withUserResults:true,
			withBirdwatchPivots:false,
		})
	}
	
	// list users who have liked (or used other reactions on) a tweet
	async get_reactors(id) {
		return this.get_graphql('GetTweetReactionTimeline', {tweetId: id, withHighlightedLabel: true, withSuperFollowsUserFields: true})
	}
	
	async create_reply(text, tweet) {
		let resp = await this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			reply: {
				in_reply_to_tweet_id: tweet,
				exclude_reply_user_ids: []
			},
			batch_compose: 'BatchSubsequent',
			
			dark_request:false,
			semantic_annotation_ids:[],
			withReactionsMetadata:false,
			withReactionsPerspective:false,
			withSuperFollowsTweetFields:false,
			withSuperFollowsUserFields:false,
			withUserResults:true,
			withBirdwatchPivots:false,
		})
	}
	
	async get_user_likes(id) {
		return this.get_graphql('Likes', {
			userId: id,
			count: 20,
			//cursor: '',
			withHighlightedLabel: true,
			withReactionsMetadata: true,
			withReactionsPerspective: true,
			withSuperFollowsTweetFields: true,
			withSuperFollowsUserFields: true,
			withTweetQuoteCount: true,
			includePromotedContent: false,
			withUserResults: true,
			withBirdwatchPivots: false,
		})
	}
	
	// note: for some reason this does NOT fill in the 'ext' field!
	async get_notifications() {
		return fetch("https://twitter.com/i/api/2/notifications/all.json"+encode_url_params({
			include_profile_interstitial_type: 1,
			include_blocking: 1,
			include_blocked_by: 1,
			include_followed_by: 1,
			include_want_retweets: 1,
			include_mute_edge: 1,
			include_can_dm: 1,
			include_can_media_tag: 1,
			skip_status: 1,
			cards_platform: 'Web-12',
			include_cards: 1,
			include_ext_alt_text: true,
			include_quote_count: true,
			include_reply_count: 1,
			tweet_mode: 'extended',
			include_entities: true,
			include_user_entities: true,
			include_ext_media_color: true,
			include_ext_media_availability: true,
			send_error_codes: true,
			simple_quoted_tweet: true,
			count: 20,
			ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo,ligma",
		}), {
			headers: this.auth_headers()
		}).then(x=>x.json())
	}
	
	async get_home() {
		return fetch("https://twitter.com/i/api/2/timeline/home_latest.json"+encode_url_params({
			include_profile_interstitial_type: 1,
			include_blocking: 1,
			include_blocked_by: 1,
			include_followed_by: 1,
			include_want_retweets: 1,
			include_mute_edge: 1,
			include_can_dm: 1,
			include_can_media_tag: 1,
			skip_status: 1,
			cards_platform: 'Web-12',
			include_cards: 1,
			include_ext_alt_text: true,
			include_quote_count: true,
			include_reply_count: 1,
			tweet_mode: 'extended',
			include_entities: true,
			include_user_entities: true,
			include_ext_media_color: true,
			include_ext_media_availability: true,
			send_error_codes: true,
			simple_quoted_tweet: true,
			earned: 1,
			count: 20,
			ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo",
		}), {
			headers: this.auth_headers()
		}).then(x=>x.json())
	}
	
	async create_bookmark(id) {
		return this.post_graphql('CreateBookmark', {
			tweet_id: id,
		})
	}
	
	////////////////////////////////
	// Authentication/Login stuff //
	////////////////////////////////
	
	// this downloads a javascript file and extracts some values from it
	// these values don't often change, but there's no point in caching them
	// since the js file will be cached forever anyway
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
	async get_guest_token() {
		console.info("fetching guest token")
		await fetch(
			"https://api.twitter.com/1.1/guest/activate.json",
			{method: "POST", headers: {authorization: "Bearer "+this.bearer}}
		).then(x=>x.json()).then(x=>{
			this.guest_token = x.guest_token
		})
	}
	
	async log_in() {
		await this.get_secrets()
		this.cookies = this.get_cookies()
		if (this.cookies._twitter_sess) {
			this.guest = false
		} else {
			await this.get_guest_token()
			this.guest = true
		}
	}
}
