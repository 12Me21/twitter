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
	
class Query extends Auth {
	constructor() {
		super()
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
}
