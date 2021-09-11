// ugh all of these fields are required and none of them are really important
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
	
class Query {
	constructor(auth) {
		this.auth = auth
		this.abort_controller = new AbortController()
		this.signal = this.abort_controller.signal
	}
	
	abort() {
		if (this.abort_controller)
			this.abort_controller.abort()
	}
	
	post_v11(url, body, extra_headers) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			method: 'POST',
			headers: {
				'Content-Type': "application/x-www-form-urlencoded",
				...this.auth.auth_headers(),
				...extra_headers,
			},
			body: encode_url_params(body, true),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	post_v11_json(url, body) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json",
				...this.auth.auth_headers(),
			},
			body: JSON.stringify(body),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	get_v11(url) {
		return fetch("https://twitter.com/i/api/1.1/"+url, {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	get_v2(path, params) {
		return fetch("https://twitter.com/i/api/2/"+path+encode_url_params(params), {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	get_graphql(type, params) {
		let q = this.auth.querys[type]
		return fetch(`https://twitter.com/i/api/graphql/${q}/${type}?variables=${encodeURIComponent(JSON.stringify(params))}`, {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	post_graphql(type, params, body) {
		let q = this.auth.mutations[type]
		return fetch(`https://twitter.com/i/api/graphql/${q}/${type}`, {
			method: 'POST',
			headers: {
				'Content-Type': "application/json;charset=UTF-8",
				...this.auth.auth_headers(),
			},
			body: JSON.stringify({variables: JSON.stringify(params), queryId: q.queryId}), // god you can't make this shit up
			signal: this.signal,
		}).then(x=>x.json()).then(x=>x.data)
	}
	
	
	async get_more_replies(tweet_id, cursor) {
		return await this.get_graphql('TweetDetail', {
			focalTweetId: tweet_id,
			cursor: cursor,
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withVoice: false,
			...query_junk,
		})
	}
	
	// note: to react to a retweet, the reaction should be created on the retweet, not the original tweet
	// it will be redirected to the original, but this allows the retweeter to get a notification about you liking their retweet etc.
	async create_reaction(id, type) {
		return await this.post_graphql('CreateTweetReaction', {
			tweet_id: id,
			reaction_type: type,
		})
	}
	
	async get_user_followers(id, cursor) {
		return await this.get_graphql('Followers', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	async get_user_following(id, cursor) {
		return await this.get_graphql('Following', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	async pin_tweet(id) {
		return await this.post_v11("account/pin_tweet.json", {
			id: id,
			tweet_mode: 'extended',
		})
	}
	async unpin_tweet(id) {
		return await this.post_v11("account/unpin_tweet.json", {
			id: id,
			tweet_mode: 'extended',
		})
	}
	
	async delete_tweet(id) {
		return await this.post_graphql('DeleteTweet', {
			tweet_id: id,
			dark_request: false,
		})
	}
	
	async get_tweet(id) {
		return await this.get_graphql('TweetDetail', {
			focalTweetId: id,
			
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withVoice: false,
			...query_junk,
		})
	}
	
	async get_user(name) {
		if (name[0]=="@")
			name = name.substr(1)
		let resp = await this.get_v11('users/show.json'+encode_url_params({
			screen_name: name,
			include_entities: true,
		}))
		return resp
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
	
	// todo: look at the v2 api version of this
	// https://developer.twitter.com/en/docs/twitter-api/tweets/timelines/api-reference/get-users-id-tweets
	async get_profile(user_id, cursor) {
		let resp = await this.get_graphql('UserTweets', {
			userId: user_id,
			count: 20,
			cursor: cursor,
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
		return await this.get_v11(`strato/column/None/tweetId=${id},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`)
	}
	
	async create_scheduled_tweet(text, date) {
		return await this.post_graphql('CreateScheduledTweet', {
			post_tweet_request: {
				status: text,
				//in_reply_to_status_id: ,
				exclude_reply_user_ids: [],
				auto_populate_reply_metadata: false,
				media_ids: [],
			},
			execute_at: Math.round(date.getTime()/1000),
		})
	}
	
	//https://upload.twitter.com/i/media/upload.json
	//https://upload.twitter.com/1.1/media/upload.json
	//https://twitter.com/i/api/1.1/media/upload.json ??
	
	//https://upload.twitter.com/1.1/media/metadata/create.json
	// https://twitter.com/i/api/1.1/media/metadata/create.json
	
	async create_tweet(text) {
		return await this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			dark_request: false,
			semantic_annotation_ids: [],
			
			...query_junk,
		})
	}
	
	// list users who have liked (or used other reactions on) a tweet
	// this does NOT support `cursor` for some reason. maybe we should be using Favoriters
	async get_reactors(id) {
		return await this.get_graphql('GetTweetReactionTimeline', {
			tweetId: id,
			withHighlightedLabel: true, withSuperFollowsUserFields: true
		})
	}
	
	async create_reply(text, tweet) {
		return await this.post_graphql('CreateTweet', {
			tweet_text: text,
			media: {media_entities: [], possibly_sensitive: false},
			reply: {
				in_reply_to_tweet_id: tweet,
				exclude_reply_user_ids: []
			},
			batch_compose: 'BatchSubsequent',
			
			dark_request: false,
			semantic_annotation_ids: [],
			...query_junk,
		})
	}
	
	async get_user_likes(id, cursor) {
		return await this.get_graphql('Likes', {
			userId: id,
			count: 20,
			cursor: cursor,
			
			withHighlightedLabel: true,
			...query_junk,
		})
	}
	
	// note: for some reason this does NOT fill in the 'ext' field!
	async get_notifications() {
		return await this.get_v2('notifications/all.json', {
			// what the fuck are these parameters
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
		})
	}
	
	async get_home() {
		return await this.get_v2('timeline/home_latest.json', {
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
		})
	}
	
	async create_bookmark(id) {
		return await this.post_graphql('CreateBookmark', {
			tweet_id: id,
		})
	}
	
	async search(string) {
		return await this.get_v2('search/adaptive.json', {
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
			q: string,
			count: 20,
			query_source: 'typed_query',
			pc: 1,
			spelling_corrections: 1,
			ext: 'mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo,superFollowMetadata',
		})
	}
	
	// data fields:
	// (only pass the ones you want to change)
	// `birthdate_day`, `birthdate_month`, `birthdate_year` - number
	// `birthdate_visibility`, `birthdate_year_visibility` - enum: self, public, followers, following, mutualfollow
	// `displayNameMaxLength` - number
	// `name` - string
	// `url` - string
	// `location` - string
	// `description` - string
	// `profile_link_color` - RRGGBB hex string
	async update_profile(data) {
		return await this.post_v11('account/update_profile.json', {
			skip_status: 1,
			...data
		})
	}
	
	async log_out() {
		let resp = await this.post_v11('account/logout.json', {}).then(x=>x.json())
		if (resp.status=='ok') {
			//this.cookies = this.read_cookies()
			return true
		}
	}
	
	async update_profile_background(blob, tile) {
		let b64 = await new Promise(resolve => {
			let reader = new FileReader();
			reader.onload = function() {
				let str = reader.result
				let start = str.indexOf(',')
				resolve(str.substr(start+1))
			}
			reader.readAsDataURL(blob)
		})
		return await this.post_v11('account/update_profile_banner.json', {
	//		image: b64,
			tile: tile,
		})
	}
	
	async get_verify_form(params) {
		// first we need to download the page and extract the form
		let html = await fetch("https://twitter.com/account/login_verification"+params, {
			headers: {
				'x-12-cookie': `_twitter_sess=${this.auth.cookies._twitter_sess}; ct0=${this.auth.cookies.ct0}; att=${this.auth.cookies.att}`,
			},
			signal: this.signal,
		}).then(x=>x.text())
		let doc = new DOMParser().parseFromString(html, 'text/html')
		let form = doc.getElementById('login-verification-form')
		return new FormData(form)
	}
	
	delete_tweet(id) {
		return this.post_graphql('DeleteTweet', {
			tweet_id: id,
			dark_request: false,
		})
	}
	
	get_followers(user_id, cursor) {
		return this.get_graphql('Followers', {
			userId: user_id,
			count: 80,
			cursor: cursor,
			withHighlightedLabel: true,
			...query_junk,
		})
	}	
	
	create_metadata(id, data) {
		return this.post_v11_json("media/metadata/create.json", {
			media_id: id,
			...data,
		})
		//{\"media_id\":\"1435940797451579395\",\"alt_text\":{\"text\":\"screenshot of html code\\ninside <body> are two elements, named <time-line> and <box-where-i-hide-the-template-elements>\"}}
	}
	
	async upload_image(file) {
		let r1 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'INIT', total_bytes: file.size, media_type: file.type, media_category: 'tweet_image'}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		//expires_after_secs: 86400
		//media_id: 1435940797451579400
		//media_id_string: "1435940797451579395"
		//media_key: "3_1435940797451579395"
		
		let fd = new FormData()
		fd.set('media', file)
		
		let r2 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'APPEND', media_id: r1.media_id_string, segment_index: 0}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			body: fd,
			signal: this.signal,
		}).then(x=>x.text())
		
		let r3 = await fetch("https://upload.twitter.com/i/media/upload.json"+encode_url_params({command: 'FINALIZE', media_id: r1.media_id_string}), {
			method: 'POST',
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		return r3
	}
	
	get_own_lists() {
		return this.get_graphql('ListsManagementPageTimeline', {
			count: 100,
			withSuperFollowsUserFields: true,
			withUserResults: true,
			withBirdwatchPivots: false,
			withReactionsMetadata: true,
			withReactionsPerspective: true,
			withSuperFollowsTweetFields: true,
		})
	}
	
	get_user_lists(id) {
		return this.get_graphql('CombinedLists', {
			userId: id,
			count: 100,
			withSuperFollowsUserFields:true
			,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:true,withReactionsPerspective:true,withSuperFollowsTweetFields:true,
		})
	}
	
	get_list_tweets(id) {
		return this.get_graphql('ListLatestTweetsTimeline', {
			listId: id,
			count: 20,
			withSuperFollowsUserFields:true,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:false,withReactionsPerspective:false,withSuperFollowsTweetFields:true,
		})
	}
	
	list_subscribe(id) {
		return this.post_graphql('ListSubscribe', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
	}
	
	list_unsubscribe(id) {
		return this.post_graphql('ListUnsubscribe', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: true,
		})
	}
	
	list_pin(id) {
		return this.post_graphql('ListPinOne', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: false
		})
	}
	
	list_unpin(id) {
		return this.post_graphql('ListUnpinOne', {
			listId: id,
			withSuperFollowsUserFields: true,
			withUserResults: false
		})
	}
	
}
