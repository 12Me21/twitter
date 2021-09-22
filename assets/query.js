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
	
	async more_replies(tweet_id, cursor) {
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
	
	// get list of 'friends' that are following a user
	friends_following(id) {
		return this.get_v11('friends/following/list.json', {
			include_profile_interstitial_type:1,
			include_blocking:1,
			include_blocked_by:1,
			include_followed_by:1,
			include_want_retweets:1,
			include_mute_edge:1,
			include_can_dm:1,
			include_can_media_tag:1,
			skip_status:1,
			cursor:-1,
			user_id:id,
			count:3,
			with_total_count:true,
		})
	}
	
	followers(id, cursor) {
		return this.get_graphql('Followers', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	following(id, cursor) {
		return this.get_graphql('Following', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	async tweet(id) {
		return await this.get_graphql('TweetDetail', {
			focalTweetId: id,
			
			with_rux_injections: false,
			withCommunity: false,
			withBirdwatchNotes: false,
			withVoice: false,
			...query_junk,
		})
	}
	
	user(name) {
		if (name[0]=="@")
			name = name.substr(1)
		return this.get_v11('users/show.json'+encode_url_params({
			screen_name: name,
			include_entities: true,
		}))
	}
	
	async bookmarks(cursor) {
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
	async profile(user_id, cursor) {
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
	
	translate_tweet(id) {
		return this.get_v11(`strato/column/None/tweetId=${id},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`)
	}
	
	//https://upload.twitter.com/i/media/upload.json
	//https://upload.twitter.com/1.1/media/upload.json
	//https://twitter.com/i/api/1.1/media/upload.json ??
	
	//https://upload.twitter.com/1.1/media/metadata/create.json
	// https://twitter.com/i/api/1.1/media/metadata/create.json
	
	// list users who have liked (or used other reactions on) a tweet
	// this does NOT support `cursor` for some reason. maybe we should be using Favoriters
	reactors(id) {
		return this.get_graphql('GetTweetReactionTimeline', {
			tweetId: id,
			withHighlightedLabel: true, withSuperFollowsUserFields: true
		})
	}
	
	user_likes(id, cursor) {
		return this.get_graphql('Likes', {
			userId: id,
			count: 20,
			cursor: cursor,
			
			withHighlightedLabel: true,
			...query_junk,
		})
	}
	
	// note: for some reason this does NOT fill in the 'ext' field!
	notifications() {
		return this.get_v2('notifications/all.json', {
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
	
	home(cursor) {
		return this.get_v2('timeline/home.json', {
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
			lca: true,
			...cursor && {cursor: cursor},
			ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo",
		})
	}
	
	// `string`: search query text
	// `cursor`: (optional) cursor id
	// return: raw response
	search(string, cursor) {
		return this.get_v2('search/adaptive.json', {
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
			query_source: '',
			...cursor&&{cursor:cursor},
			pc: 1,
			spelling_corrections: 1,
			ext: 'mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo,superFollowMetadata',
		})
	}
	
	// get own lists
	own_lists() {
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
	
	user_lists(id) {
		return this.get_graphql('CombinedLists', {
			userId: id,
			count: 100,
			withSuperFollowsUserFields:true,
			withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:true,withReactionsPerspective:true,withSuperFollowsTweetFields:true,
		})
	}
	
	list(id) {
		return this.get_graphql('ListLatestTweetsTimeline', {
			listId: id,
			count: 20,
			withSuperFollowsUserFields:true,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:false,withReactionsPerspective:false,withSuperFollowsTweetFields:true,
		})
	}
	
	// this is normally the first significant request when you load the page.
	// it contains important info like your username, language, etc.
	settings() {
		return this.get_v11('account/settings.json', {
			include_mention_filter: true,
			include_nsfw_user_flag: true,
			include_nsfw_admin_flag: true,
			include_ranked_timeline: true,
			include_alt_text_compose: true,
			ext: 'ssoConnections',
			include_country_code: true,
			include_ext_dm_nsfw_media_filter: true,
		})
	}
}
