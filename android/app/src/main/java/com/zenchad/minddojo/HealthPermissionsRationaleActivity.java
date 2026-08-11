package com.zenchad.minddojo;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class HealthPermissionsRationaleActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        int gap = Math.round(14 * getResources().getDisplayMetrics().density);

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(padding, padding, padding, padding);
        content.setBackgroundColor(Color.rgb(250, 248, 244));

        TextView title = new TextView(this);
        title.setText("Zenchad + Health Connect");
        title.setTextSize(25f);
        title.setTextColor(Color.rgb(31, 35, 38));
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        content.addView(title, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView body = new TextView(this);
        body.setText(
            "Health Connect is optional in Zenchad. When you choose Add Watch Stats after a completed run, " +
            "Zenchad can read heart-rate and step/cadence records that overlap that run.\n\n" +
            "The imported run metrics and a compact set of samples are stored in Zenchad's local app storage so " +
            "they can appear in your run summary and history. They are not used to decide Story chase outcomes, " +
            "and granting Health Connect access is never required to track a run or earn XP.\n\n" +
            "You can decline access or revoke it later from Health Connect settings. Zenchad will continue to work " +
            "without these watch statistics."
        );
        body.setTextSize(17f);
        body.setTextColor(Color.rgb(62, 67, 71));
        body.setLineSpacing(0f, 1.18f);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bodyParams.topMargin = gap;
        content.addView(body, bodyParams);

        scroll.addView(content);
        setContentView(scroll);
    }
}
