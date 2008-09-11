/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
const nsIIOService = Ci.nsIIOService;
const nsIRequest = Ci.nsIRequest;
const nsICachingChannel = Ci.nsICachingChannel;
const nsIScriptableInputStream = Ci.nsIScriptableInputStream;
const nsIUploadChannel = Ci.nsIUploadChannel;
const nsIHttpChannel = Ci.nsIHttpChannel;

const IOService = Cc["@mozilla.org/network/io-service;1"];
const ioService = IOService.getService(nsIIOService);
const ScriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"];
const chromeReg = CCSV("@mozilla.org/chrome/chrome-registry;1", "nsIToolkitChromeRegistry");

const LOAD_FROM_CACHE = nsIRequest.LOAD_FROM_CACHE;
const LOAD_BYPASS_LOCAL_CACHE_IF_BUSY = nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

const NS_BINDING_ABORTED = 0x804b0002;

// ************************************************************************************************

top.SourceCache = function(context)
{
    this.context = context;
    this.cache = {};
};

top.SourceCache.prototype =
{
    loadText: function(url, method, file)
    {
        var lines = this.load(url, method, file);
        return lines ? lines.join("\n") : null;
    },

    load: function(url, method, file)
    {
        if ( this.cache.hasOwnProperty(url) )
            return this.cache[url];

        var d = FBL.reDataURL.exec(url);
        if (d)
        {
            var src = url.substring(FBL.reDataURL.lastIndex);
            var data = decodeURIComponent(src);
            var lines = data.split(/\r\n|\r|\n/);
            this.cache[url] = lines;

            return lines;
        }

        var j = FBL.reJavascript.exec(url);
        if (j)
        {
            var src = url.substring(FBL.reJavascript.lastIndex);
            var lines = src.split(/\r\n|\r|\n/);
            this.cache[url] = lines;

            return lines;
        }

        var c = FBL.reChrome.test(url);
        if (c)
        {
            if (Firebug.filterSystemURLs)
                return;  // ignore chrome

            var chromeURI = ioService.newURI(url, null, null);
            var localURI = chromeReg.convertChromeURL(chromeURI);
            if (FBTrace.DBG_CACHE)
                FBTrace.sysout("sourceCache.load converting chrome to local: "+url, " -> "+localURI.spec);
            url = localURI.spec;
        }

        var doc = this.context.window.document;
        if (doc)
            var charset = doc.characterSet;
        else
            var charset = "UTF-8";

        var channel;
        try
        {
            channel = ioService.newChannel(url, null, null);
            channel.loadFlags |= LOAD_FROM_CACHE | LOAD_BYPASS_LOCAL_CACHE_IF_BUSY;

            if (method && (channel instanceof nsIHttpChannel))
            {
                var httpChannel = QI(channel, nsIHttpChannel);
                httpChannel.requestMethod = method;
            }
        }
        catch (exc)
        {
            if (FBTrace.DBG_CACHE)                                                                                     /*@explore*/
                FBTrace.dumpProperties("sourceCache for url:"+url+" window="+this.context.window.location.href+" FAILS:", exc); /*@explore*/
            return;
        }

        if (url == this.context.browser.contentWindow.location.href)
        {
            if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load content window href\n");                                             /*@explore*/
            if (channel instanceof nsIUploadChannel)
            {
                var postData = getPostStream(this.context);
                if (postData)
                {
                    var uploadChannel = QI(channel, nsIUploadChannel);
                    uploadChannel.setUploadStream(postData, "", -1);
                    if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load uploadChannel set\n");                                             /*@explore*/
                }
            }

            if (channel instanceof nsICachingChannel)
            {
                var cacheChannel = QI(channel, nsICachingChannel);
                cacheChannel.cacheKey = getCacheKey(this.context);
                if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load cacheChannel key"+cacheChannel.cacheKey+"\n");                                             /*@explore*/
            }
        }
        else if ((method == "PUT" || method == "POST") && file)
        {
            if (channel instanceof nsIUploadChannel)
            {
                // In case of PUT and POST, don't forget to use the original body.
                var postData = getPostText(file, this.context);
                if (postData)
                {
                    var postDataStream = getInputStreamFromString(postData);
                    var uploadChannel = QI(channel, nsIUploadChannel);
                    uploadChannel.setUploadStream(postDataStream, "application/x-www-form-urlencoded", -1);
                    if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load uploadChannel set\n");                                             /*@explore*/
                }
            }
        }


        var stream;
        try
        {
            if (FBTrace.DBG_CACHE) FBTrace.sysout("sourceCache.load url:"+url+"\n");                                             /*@explore*/
            stream = channel.open();
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
            {
                var isCache = (channel instanceof nsICachingChannel)?"nsICachingChannel":"NOT caching channel";            /*@explore*/
                var isUp = (channel instanceof nsIUploadChannel)?"nsIUploadChannel":"NOT nsIUploadChannel";                /*@explore*/
                FBTrace.sysout(url+" vs "+this.context.browser.contentWindow.location.href+" and "+isCache+" "+isUp+"\n"); /*@explore*/
                FBTrace.dumpProperties("sourceCache.load fails channel.open for url="+url+ " cause:", exc);                /*@explore*/
                FBTrace.dumpStack("sourceCache.load fails channel=", channel);                                        /*@explore*/
            }
            return;
        }

        try
        {
            var data = readFromStream(stream, charset);
            var lines = data.split(/\r\n|\r|\n/);
            this.cache[url] = lines;
            return lines;
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)                                                         /*@explore*/
                FBTrace.dumpProperties("sourceCache.load FAILS, url="+url, exc);                    /*@explore*/
            return "sourceCache.load FAILS for url="+url+exc.toString();
        }
        finally
        {
            stream.close();
        }
    },

    store: function(url, text)
    {
        if (FBTrace.DBG_CACHE)                                                                                         /*@explore*/
            FBTrace.sysout("sourceCache for window="+this.context.window.location.href+" store url="+url+"\n");        /*@explore*/
        var lines = splitLines(text);
        return this.cache[url] = lines;
    },

    invalidate: function(url)
    {
        delete this.cache[url];
    },

    getLine: function(url, lineNo)
    {
        var lines = this.load(url);
        return lines ? lines[lineNo-1] : null;
    }
};

// xxxHonza getPostText and readPostTextFromRequest are copied from
// net.js. These functions should be removed when this cache is 
// refactored due to the double-load problem.
function getPostText(file, context)
{
    if (!file.postText)
        file.postText = readPostTextFromPage(file.href, context);

    if (!file.postText)
        file.postText = readPostTextFromRequest(file.request, context);

    return file.postText;
}

// ************************************************************************************************

function getPostStream(context)
{
    try
    {
        var webNav = context.browser.webNavigation;
        var descriptor = QI(webNav, Ci.nsIWebPageDescriptor).currentDescriptor;
        var entry = QI(descriptor, Ci.nsISHEntry);

        if (entry.postData)
        {
            // Seek to the beginning, or it will probably start reading at the end
            var postStream = QI(entry.postData, Ci.nsISeekableStream);
            postStream.seek(0, 0);
            return postStream;
        }
     }
     catch (exc)
     {
     }
}

function getCacheKey(context)
{
    try
    {
        var webNav = context.browser.webNavigation;
        var descriptor = QI(webNav, Ci.nsIWebPageDescriptor).currentDescriptor;
        var entry = QI(descriptor, Ci.nsISHEntry);
        return entry.cacheKey;
     }
     catch (exc)
     {
     }
}

function doublePostForbiddenMessage(url)
{
    var msg = "Firebug needs to POST to the server to get this information for url: "+url+"\n";
    msg += " This second POST can interfere with some sites.\n"
    msg += " If you want to send the POST again, open a new tab in Firefox, use URL 'about:config', ";
    msg += "set boolean value 'extensions.firebug.allowDoublePost' to true\n";
    msg += " This value is reset every time you restart Firefox\n";
    msg += " This problem will disappear when https://bugzilla.mozilla.org/show_bug.cgi?id=430155 is shipped\n";

    if (FBTrace.DBG_CACHE)
        FBTrace.sysout(msg);

    return msg.split('\n');
}

// ************************************************************************************************

}});
