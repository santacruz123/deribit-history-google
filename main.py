import webapp2
import urllib2
class HourCronPage(webapp2.RequestHandler):
    def get(self):
        request = urllib2.Request('https://us-central1-deribit-220920.cloudfunctions.net/history')
        response = urllib2.urlopen(request, timeout=30)
app = webapp2.WSGIApplication([
    ('/minute', HourCronPage),
    ], debug=True)
