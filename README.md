(WIP replacement for the official twitter client, implemented as a browser extension)

**currently works in Edge (and probably chrome)**
I'll add firefox support eventually (extensions are mostly the same but there are some slight compatibility differences)

- runs entirely in a web browser (no server required)
- makes requests directly to the twitter API (no increased latency from a proxy server)
- uses the same secret internal API as the official site
- automatically overrides all pages at https://twitter.com/...
- uses the same session cookies so you don't have to log in/out when enabling/disabling the extension

This is /mostly/ a normal website, but due to limitations of javascript, it needs a browser extension

The extension basically does 3 things:

- replaces https://twitter.com with a custom page  
  (this is /required/, because their api can only be accessed from pages on this domain)  
  (this also means: this client can act as a total replacement for twitter.com, and you can just visit and share twitter links normally)
- removes `set-cookie` headers from http responses
- removes the automatic `cookie` headers from http requests
- allows javascript fetch/xhr requests to manually set the `cookie` header (required for authentication)


P.S. if anyone knows a way for an extension to remove <link> preloads so those warnings go away, PLEASE tell me   aaaaaaa  


## Questions:

"does this project have a name?"
 no

"will I get banned from twitter for using this"
 probably not

"does this violate the twitter TOS?"
 haven't read it

"will this hijack my twitter account?"
 why are you asking me this?

