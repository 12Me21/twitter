// ugh all of these fields are required and none of them are really important
// graphql api
let query_junk = {
	withTweetQuoteCount: true,
	includePromotedContent: false,
	withReactionsMetadata: true,
	withReactionsPerspective: true,
	withBirdwatchPivots: true,
	withSuperFollowsUserFields: true,
	withSuperFollowsTweetFields: true,
	withUserResults: true,
	withNftAvatar: true,
	withVoice: false, // ??
}

// what the fuck are these parameters
// v1.1 api
let query_junk_2 = {
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
	include_replypp_count: 1,
	tweet_mode: 'extended',
	include_entities: true,
	include_user_entities: true,
	include_ext_media_color: true,
	include_ext_media_availability: true,
	//include_ext_has_nft_avatar: true,
	send_error_codes: true,
	simple_quoted_tweet: true,
}

class TimelineRequest {
	#request //testing
	#process
	
	constructor(request, process) {
		this.#request = request
		this.#process = process
	}
	// maybe the Query should be stored in this class somehow
	async get(cursor) { // returns [timeline, objects]
		let resp = await this.#request(cursor)
		try {
			// we catch all errors in .process since .process should just be like x => x.user.result
			// i.e. we're just going to get errors when the response data was formatted unexpectedly
			return this.#process(resp)
		} catch (e) {
			// this shouldn't be an api error, or at least not the same type
			// the error is due to unexpected formatting of the response data, mm
			throw new ApiError(resp)
		}
	}
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
	
	async get_v11(path, params) {
		if (params)
			path = path + encode_url_params(params)
		let resp = await fetch("https://twitter.com/i/api/1.1/"+path, {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		// todo: i think with v1.1 we can use the http response code instead
		if (resp.errors && resp.errors.length)
			throw new ApiError(resp)
		return resp
	}
	
	get_v2(path, params) {
		return fetch("https://twitter.com/i/api/2/"+path+encode_url_params(params), {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
	}
	
	async get_graphql(type, params) {
		let q = this.auth.app.querys[type]
		let url = `https://twitter.com/i/api/graphql/${q}/${type}?variables=${encodeURIComponent(JSON.stringify(params))}`
		let resp = await fetch(url, {
			headers: this.auth.auth_headers(),
			signal: this.signal,
		}).then(x=>x.json())
		if (resp.errors && resp.errors.length)
			throw new ApiError(resp)
		return resp.data
	}
	

	
	// get list of 'friends' that are following a user
	friends_following(id, count) {
		return this.get_v11('friends/following/list.json', {
			include_profile_interstitial_type: 1,
			include_blocking: 1,
			include_blocked_by: 1,
			include_followed_by: 1,
			include_want_retweets: 1,
			include_mute_edge: 1,
			include_can_dm: 1,
			include_can_media_tag: 1,
			skip_status: 1,
			cursor: -1,
			user_id: id,
			count: count || 3,
			with_total_count: true,
		})
	}
	
	followers(cursor, id) {
		return this.get_graphql('Followers', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	following(cursor, id) {
		return this.get_graphql('Following', {
			userId: id,
			count: 20,
			cursor: cursor,
			...query_junk,
		})
	}
	
	tweet(id) {
		return new TimelineRequest(cursor => 
			this.get_graphql('TweetDetail', {
				focalTweetId: id,
				with_rux_injections: false,
				withCommunity: false,
				withBirdwatchNotes: false,
				cursor: cursor,
				withVoice: false,
				...query_junk,
			}),
			resp => [resp.threaded_conversation_with_injections],
		)
	}

	// single
	user(name) {
		if (name[0]=="@")
			name = name.substr(1)
		return this.get_v11('users/show.json'+encode_url_params({
			screen_name: name,
			include_entities: true,
		}))
	}
	
	// single
	translate_tweet(id) {
		return this.get_v11(`strato/column/None/tweetId=${id},destinationLanguage=None,translationSource=Some(Google),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`)
	}
	
	bookmarks(cursor) {
		return new TimelineRequest(cursor => 
			this.get_graphql('Bookmarks', {
				count: 20,
				...cursor&&{cursor},
				withHighlightedLabel: false,
				...query_junk,
			}),
			resp => [resp.bookmark_timeline.timeline],
		)
	}
	
	// todo: look at the v2 api version of this?
	// https://developer.twitter.com/en/docs/twitter-api/tweets/timelines/api-reference/get-users-id-tweets
	user_tweets(user_id) {
		// this returns a new TimelineRequest object, with the current parameters
		// calling .get() returns the initial items
		// or you can call .get(cursor) to pass a cursor
		return new TimelineRequest(cursor =>
			this.get_graphql('UserTweets', {
				userId: user_id,
				count: 20,
				cursor: cursor,
				withVoice: true,
				...query_junk,
			}),
			resp => [resp.user.result.timeline.timeline]
		)
	}
	
	// tweets incl. replies
	user_all_tweets(user_id) {
		return new TimelineRequest(cursor =>
			this.get_graphql('UserTweetsAndReplies', {
				userId: user_id,
				count: 20,
				...cursor && {cursor},
				...query_junk,
			}),
			resp => [resp.user.result.timeline.timeline]
		)
	}
	
	// list users who have liked (or used other reactions on) a tweet
	// this does NOT support `cursor` for some reason. maybe we should be using Favoriters
	reactors(cursor, id) {
		return this.get_graphql('GetTweetReactionTimeline', {
			tweetId: id,
			withHighlightedLabel: true, withSuperFollowsUserFields: true
		})
	}
	
	user_likes(cursor, id) {
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
		return new TimelineRequest(cursor =>
			this.get_v2('notifications/all.json', {
				...query_junk_2,
				...cursor&&{cursor},
				count: 20,
				ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo",
			}),
			resp => [resp.timeline, resp.globalObjects],
		)
	}
	
	home(cursor) {
		return this.get_v2('timeline/home.json', {
			...query_junk_2,
			earned: 1,
			count: 3,
			lca: true,
			...cursor && {cursor: cursor},
			ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo",
		})
	}
	latest() {
		return new TimelineRequest(cursor => 
			this.get_v2('timeline/home_latest.json', {
				...query_junk_2,
				earned: 1,
				count: 3,
				lca: true,
				...cursor && {cursor: cursor},
				ext: "mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo",
			}),
			resp => [resp.timeline, resp.globalObjects],
		)
	}
	
	// `string`: search query text
	// `cursor`: (optional) cursor id
	// return: raw response
	search(string) {
		console.log("search req");
		return new TimelineRequest(cursor =>
			this.get_v2('search/adaptive.json', {
				...query_junk_2,
				q: string,
				count: 20,
				query_source: '',
				...cursor&&{cursor:cursor},
				pc: 1,
				spelling_corrections: 1,
				ext: 'mediaStats,highlightedLabel,signalsReactionMetadata,signalsReactionPerspective,voiceInfo,superFollowMetadata',
			}),
			resp => [resp.timeline, resp.globalObjects],
		)
	}
	
	// get own lists
	own_lists(cursor) {
		return this.get_graphql('ListsManagementPageTimeline', {
			count: 100,
			...cursor&&{cursor},
			withSuperFollowsUserFields: true,
			withUserResults: true,
			withBirdwatchPivots: false,
			withReactionsMetadata: true,
			withReactionsPerspective: true,
			withSuperFollowsTweetFields: true,
		})
	}
	
	user_lists(cursor, id) {
		return this.get_graphql('CombinedLists', {
			userId: id,
			count: 100,
			...cursor&&{cursor},
			withSuperFollowsUserFields:true,
			withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:true,withReactionsPerspective:true,withSuperFollowsTweetFields:true,
		})
	}
	
	// this is used by the twitter.com/i/lists page
	list(cursor, id) {
		return this.get_graphql('ListLatestTweetsTimeline', {
			listId: id,
			count: 20,
			withSuperFollowsUserFields:true,withUserResults:true,withBirdwatchPivots:false,withReactionsMetadata:false,withReactionsPerspective:false,withSuperFollowsTweetFields:true,
		})
	}
	//this is used when you click "add to lists" on a user's profile
	// which for some reason has the url: https://mobile.twitter.com/i/lists/add_member (does not contain the user's name? so idk what the UI for this one looked like originally)
	// returns all of your lists.
	list_ownerships(cursor, my_id, user_id) {
		return this.get_graphql('ListOwnerships', {
			userId: my_id,
			isListMemberTargetUserId: user_id,
			count: 20,
			withSuperFollowsUserFields: true,
			withUserResults: false,
			withBirdwatchPivots: false,
			withReactionsMetadata: false,
			withReactionsPerspective: false,
			withSuperFollowsTweetFields: true
		})
		// data.user.result.timeline.timeline contains render instructions
		// the `is_member` field is `true` for lists which contain the target user.
	}
	// this is ALSO requested with the previous, for some reason. seems to be redundant
	// this returns all of your lists that contain `user_id`.
	list_memberships(user_id) {
		return this.get_v11('lists/memberships.json', {
			cursor: -1,
			user_id: user_id,
			count: 1000,
			filter_to_owned_lists: true,
		})
		// response example: (user is in one list)
		/*{
			"next_cursor":0,
			"next_cursor_str":"0",
			"previous_cursor":0,
			"previous_cursor_str":"0",
			"lists":[{
				"id":<id>,
				"id_str":"<id>",
				"name":"test",
				"uri":"\/12Me21_\/lists\/test",
				"subscriber_count":0,
				"member_count":14,
				"mode":"private",
				"description":"test",
				"slug":"test",
				"full_name":"@12Me21_\/test",
				"created_at":"Fri Apr 03 01:47:07 +0000 2020",
				"following":true,
				"user":{<list owner info>}
			}]
		}*/
	}
	
	// single
	moment(id) {
		return this.get_v11('live_event/1/'+id+'/timeline.json', {
			count: 0,
			urt: true,
		})
	}
	
	moment_tweets(cursor, id) {
		return this.get_v2('live_event/timeline/'+id+'.json', {
			...query_junk_2,
			timeline_id: 'recap',
			count: 20,
			ext: 'mediaStats,highlightedLabel,voiceInfo,superFollowMetadata,signalsReactionMetadata,signalsReactionPerspective',
			cursor: cursor,
			urt: true,
			get_annotations: true,
		})
		// return [resp.whatever.timeline, cursor=>this.moment_tweets(cursor, id)]
	}
	
	biz_profile(user) {
		return this.get_graphql('BizProfileFetchUser', {rest_id: user})
	}
	
}
