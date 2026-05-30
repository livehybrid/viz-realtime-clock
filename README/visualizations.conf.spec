# visualizations.conf.spec
#
# Spec for the realtime_clock visualization. Mirrors the keys read by
# visualization_source.js so admins editing visualizations.conf get hinting.

[realtime_clock]
label = <string>
* Display name in the viz picker.

description = <string>
* Short description shown alongside the viz.

search_fragment = <string>
* Seed SPL used when the user inserts the viz from the visualization picker.

default_height = <integer>
* Default panel height in pixels.

allow_user_selection = <boolean>
* Whether end-users can choose this viz from the picker.

# Property namespace: display.visualizations.custom.viz-realtime-clock.realtime_clock.*

handColor = <hex-color>
* Hour & minute hand colour. Default: #6aa3f8.

secondHandColor = <hex-color>
* Second hand + centre cap colour. Default: #00d4aa.

tickColor = <hex-color>
* Colour of the tick marks. Default: #00d4aa.

showDigital = <boolean>
* Show the HH:MM:SS digital readout below the dial. Default: true.

timezone = <local|utc>
* Render time in the browser's local zone or UTC. Default: local.

showDate = <boolean>
* Show the date string below the dial. Default: true.

showGlow = <boolean>
* Apply a soft neon glow on the second hand & centre cap. Default: true.
