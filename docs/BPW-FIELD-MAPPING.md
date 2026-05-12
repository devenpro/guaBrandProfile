# BPW Field Mapping Reference

## Drupal Content Type Fields

| Field | Machine Name | Widget | Purpose |
|-------|-------------|--------|---------|
| Title | `title` | Text | Brand name (auto-filled by wizard) |
| JSON Data | `field_json_data` | Textarea | Main app data — v2 schema JSON |
| JSON Meta | `field_json_meta` | Textarea | Config, schema version, AI settings |
| Activity Log | `field_activity_log` | Textarea | Event log JSON array |
| Brand Core | `field_brand_core` | Textarea | Export: core brand context |
| Brand Video | `field_brand_video` | Textarea | Export: video creation context |
| Brand Content | `field_brand_content` | Textarea | Export: content creation guide |
| Brand SEO | `field_brand_seo` | Textarea | Export: SEO guide |
| Brand Social | `field_brand_social` | Textarea | Export: social media context |
| LLM Config | (div `.llm-config-data`) | Hidden | AI provider configuration |

## v2 JSON Schema (field_json_data)

```json
{
  "meta": {
    "schema_version": "2.0",
    "brand_level": "growing",
    "brand_types": ["commercial", "creator"],
    "brand_subtypes": {},
    "language": "en",
    "wizard_status": "in_progress | complete",
    "wizard_progress": {
      "completed_steps": ["welcome", "detect", "basics"],
      "current_step": "market",
      "skipped_steps": []
    },
    "modules_enabled": ["identity", "voice", "messaging", ...],
    "detection_answers": { "does": [], "where": "", "revenue": [] },
    "created": "ISO timestamp",
    "last_modified": "ISO timestamp",
    "ai_provider_used": "claude",
    "ai_model_used": "claude-3.5-sonnet"
  },
  "identity": { "name": "", "mission": "", "vision": "", "values": [], ... },
  "voice": { "primary_tone": "", "personality_traits": [], "dos": [], "donts": [], ... },
  "messaging": { "primary_message": "", "supporting_messages": [], "headlines": [] },
  "audience": { "primary_description": "", "segments": [], "personas": [] },
  "offerings": { "items": [], "pricing_model": "" },
  "market": { "category": "", "positioning": "", "competitors": [], "differentiators": [] },
  "content_strategy": { "pillars": [], "channels": [], "seo_keywords": [], "hashtags": [] },
  "_wizard_state": {
    "seed_context": { "name": "", "description": "", "website_url": "", ... },
    "imported_assets": { "website": { "url": "", "status": "success", "extracted": {...} } },
    "discovery_answers": { "q1": { "text": "..." }, "q2": { "selected": 0, "detail": "" } },
    "generated_sections": { "voice_tone": "...", "market_category": "...", ... },
    "section_states": { "voice_tone": "accepted", "market_category": "accepted", ... }
  },
  "ai_preferences": { "default_provider": "", "default_model": "", "custom_instructions": "" }
}
```

## Assembly Map (Flat Key → Module.Field)

| Flat Key | Module | Field | AI Prompt |
|----------|--------|-------|-----------|
| `identity_mission` | identity | mission | identity |
| `identity_mission_options` | _internal | — | identity |
| `identity_vision` | identity | vision | identity |
| `identity_values` | identity | values | identity |
| `identity_archetype` | identity | brand_archetype | identity |
| `identity_pitch` | identity | elevator_pitch | identity |
| `voice_tone` | voice | primary_tone | voice |
| `voice_personality` | voice | personality_traits | voice |
| `voice_dos` | voice | dos | voice |
| `voice_donts` | voice | donts | voice |
| `voice_preferred` | voice | vocabulary.preferred_terms | voice |
| `voice_avoided` | voice | vocabulary.avoided_terms | voice |
| `voice_sample` | voice | sample_texts | voice |
| `messaging_primary` | messaging | primary_message | voice |
| `messaging_supporting` | messaging | supporting_messages | voice |
| `messaging_headlines` | messaging | headlines | voice |
| `audience_primary` | audience | primary_description | audience |
| `audience_segments` | audience | segments | audience |
| `audience_personas` | audience | personas | audience |
| `market_category` | market | category | market |
| `market_positioning` | market | positioning | market |
| `market_competitors` | market | competitors | market |
| `market_differentiators` | market | differentiators | market |
| `market_trends` | market | trends | market (deep) |
| `market_opportunities` | market | opportunities | market (deep) |
| `offerings_items` | offerings | items | offerings |
| `offerings_content` | offerings | content_description | offerings |
| `offerings_revenue` | offerings | revenue_streams | offerings |
| `offerings_pricing` | offerings | pricing_model | offerings |
| `offerings_programs` | offerings | programs | offerings |
| `content_pillars` | content_strategy | pillars | content |
| `content_channels` | content_strategy | channels | content |
| `content_seo` | content_strategy | seo_keywords | content |
| `content_hashtags` | content_strategy | hashtags | content |

## Completeness Scoring (Review Page)

| Module | Checked Fields | Labels |
|--------|---------------|--------|
| identity | name, description, mission, vision, values, brand_archetype, elevator_pitch | Brand name, Description, Mission, Vision, Core values, Archetype, Elevator pitch |
| voice | primary_tone, personality_traits, dos, donts | Primary tone, Personality traits, Do rules, Don't rules |
| messaging | primary_message, supporting_messages | Primary message, Supporting messages |
| audience | primary_description, segments | Primary audience, Segments |
| offerings | items | Offerings list |
| market | category, positioning, competitors, differentiators | Category, Positioning, Competitors, Differentiators |
| content_strategy | pillars, channels, seo_keywords | Pillars, Channels, SEO keywords |

## Export Context Schemas

### Core (field_brand_core)
```json
{
  "brand_name": "", "website": "", "tagline": "", "mission": "", "vision": "",
  "industry": "", "brand_archetype": "", "brand_voice": "",
  "elevator_pitch": "", "values": [],
  "audience": { "primary": "", "segments": [], "pain": "" },
  "differentiators": [], "dos": [], "donts": [],
  "preferred_terms": [], "avoided_terms": [],
  "primary_message": "", "supporting_messages": []
}
```

### Video (field_brand_video)
```json
{
  "channel": "", "content_pillars": [{ "pillar": "", "topics": [] }],
  "video_tone": "", "personality_traits": [], "dos": [], "donts": [],
  "brand_voice_sample": "", "preferred_terms": [], "avoided_terms": [],
  "headlines": [], "primary_message": "", "target_audience": ""
}
```

### Content (field_brand_content)
```json
{
  "content_pillars": [{ "pillar": "", "description": "", "topics": [] }],
  "channels": [{ "channel": "", "purpose": "", "frequency": "" }],
  "writing_tone": "", "dos": [], "donts": [],
  "preferred_terms": [], "avoided_terms": [],
  "primary_message": "", "supporting_messages": [],
  "brand_voice_sample": "", "seo_keywords": [], "hashtags": [],
  "target_audience": ""
}
```

### SEO (field_brand_seo)
```json
{
  "domain": "", "industry": "", "brand_name": "",
  "keyword_clusters": [{ "keyword": "", "seed": "" }],
  "competitor_analysis": [{ "name": "", "strengths": [], "weaknesses": [] }],
  "content_pillars": [], "target_audience": "",
  "differentiators": [], "market_category": "", "positioning": ""
}
```

### Social (field_brand_social)
```json
{
  "brand_name": "", "primary_tone": "", "personality_traits": [],
  "dos": [], "donts": [],
  "primary_message": "", "supporting_messages": [],
  "headlines": [{ "context": "", "headline": "" }],
  "hashtags": [], "preferred_terms": [], "avoided_terms": [],
  "target_audience": "", "content_pillars": [], "brand_voice_sample": ""
}
```

### Meta (field_json_meta)
```json
{
  "schema_version": "2.0", "brand_level": "", "brand_types": [],
  "language": "en", "modules_enabled": [],
  "ai_provider": "", "ai_model": "",
  "created": "", "last_modified": "", "wizard_status": ""
}
```

### Activity Log (field_activity_log)
```json
[
  { "action": "step_completed", "step": "basics", "label": "Basics", "timestamp": "" },
  { "action": "section_accepted", "section": "voice_tone", "source": "ai", "timestamp": "" }
]
```
