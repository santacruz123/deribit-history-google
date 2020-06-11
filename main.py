import webapp2
import urllib2
class HourCronPage(webapp2.RequestHandler):
    def get(self):
        request = urllib2.Request('https://us-central1-deribit-220920.cloudfunctions.net/history_v3')
        response = urllib2.urlopen(request, timeout=120)
app = webapp2.WSGIApplication([
    ('/minute', HourCronPage),
    ], debug=True)
