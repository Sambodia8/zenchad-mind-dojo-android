package com.zenchad.minddojo;

import android.location.Address;
import android.location.Geocoder;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** Optional names for recorded coordinates; never blocks saving a run. */
@CapacitorPlugin(name = "RunningPlace")
public class RunningPlacePlugin extends Plugin {
    @PluginMethod
    public void lookup(PluginCall call) {
        Double lat = call.getDouble("lat");
        Double lng = call.getDouble("lng");
        if (lat == null || lng == null || !Double.isFinite(lat) || !Double.isFinite(lng)
                || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Geocoder.isPresent()) {
            call.resolve(new JSObject());
            return;
        }
        AtomicBoolean done = new AtomicBoolean();
        Handler handler = new Handler(Looper.getMainLooper());
        Runnable timeout = () -> {
            if (done.compareAndSet(false, true)) call.resolve(new JSObject());
        };
        handler.postDelayed(timeout, 8000);
        Consumer<List<Address>> receive = addresses -> {
                if (!done.compareAndSet(false, true)) return;
                handler.removeCallbacks(timeout);
                JSObject result = new JSObject();
                if (addresses != null && !addresses.isEmpty()) {
                    Address address = addresses.get(0);
                    // Avoid house numbers/private address lines; use road or locality.
                    for (String name : new String[] { address.getThoroughfare(),
                            address.getSubLocality(), address.getLocality() }) {
                        if (name != null && !name.trim().isEmpty()) {
                            result.put("name", name.trim());
                            break;
                        }
                    }
                }
                call.resolve(result);
        };
        Geocoder geocoder = new Geocoder(getContext(), Locale.getDefault());
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                geocoder.getFromLocation(lat, lng, 1, new Geocoder.GeocodeListener() {
                    @Override public void onGeocode(List<Address> addresses) { receive.accept(addresses); }
                    @Override public void onError(String error) { timeout.run(); }
                });
            } catch (Exception error) { timeout.run(); }
        } else {
            // The legacy API is blocking, so keep it off the UI and bridge threads.
            new Thread(() -> {
                try { receive.accept(geocoder.getFromLocation(lat, lng, 1)); }
                catch (Exception error) { timeout.run(); }
            }, "run-place-lookup").start();
        }
    }
}
