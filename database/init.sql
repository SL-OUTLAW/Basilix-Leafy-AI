CREATE EXTENSION IF NOT EXISTS vector;
--
-- PostgreSQL database dump
--

\restrict APP3JytaCBK8KNaucImz1cCxOHSJPfxS1rY2iBbEfRWbnw0jyDAmZezSuQUYDpc

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: get_farm_dashboard(); Type: FUNCTION; Schema: public; Owner: leafy_ai
--

CREATE FUNCTION public.get_farm_dashboard() RETURNS TABLE(total_sensors bigint, sensors_ok bigint, sensors_alert bigint, total_recommendations bigint, pending_recommendations bigint, reviewed_recommendations bigint)
    LANGUAGE sql
    AS $$
    SELECT
        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
        ),

        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
            WHERE sensor_status = 'OK'
        ),

        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
            WHERE sensor_status = 'ALERT'
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
            WHERE LOWER(status) = 'pending'
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
            WHERE LOWER(status) = 'reviewed'
        );
$$;


ALTER FUNCTION public.get_farm_dashboard() OWNER TO leafy_ai;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: sensor_readings; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.sensor_readings (
    reading_id bigint NOT NULL,
    sensor_id bigint NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    value double precision,
    quality_status character varying(20)
);


ALTER TABLE public.sensor_readings OWNER TO leafy_ai;

--
-- Name: _hyper_2_2_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: leafy_ai
--

CREATE TABLE _timescaledb_internal._hyper_2_2_chunk (
    CONSTRAINT constraint_2 CHECK (((recorded_at >= '2026-08-06 00:00:00+00'::timestamp with time zone) AND (recorded_at < '2026-08-13 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.sensor_readings);


ALTER TABLE _timescaledb_internal._hyper_2_2_chunk OWNER TO leafy_ai;

--
-- Name: ai_recommendations; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.ai_recommendations (
    recommendation_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    recommendation_type character varying(50),
    message text NOT NULL,
    risk_level character varying(20),
    status character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by bigint
);


ALTER TABLE public.ai_recommendations OWNER TO leafy_ai;

--
-- Name: ai_recommendations_recommendation_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.ai_recommendations_recommendation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_recommendations_recommendation_id_seq OWNER TO leafy_ai;

--
-- Name: ai_recommendations_recommendation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.ai_recommendations_recommendation_id_seq OWNED BY public.ai_recommendations.recommendation_id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.audit_logs (
    log_id bigint NOT NULL,
    user_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    action_type character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO leafy_ai;

--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.audit_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_log_id_seq OWNER TO leafy_ai;

--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.audit_logs_log_id_seq OWNED BY public.audit_logs.log_id;


--
-- Name: cameras; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.cameras (
    camera_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    camera_type character varying(100),
    location_description character varying(255),
    status character varying(20),
    installed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cameras OWNER TO leafy_ai;

--
-- Name: cameras_camera_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.cameras_camera_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cameras_camera_id_seq OWNER TO leafy_ai;

--
-- Name: cameras_camera_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.cameras_camera_id_seq OWNED BY public.cameras.camera_id;


--
-- Name: farms; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.farms (
    farm_id bigint NOT NULL,
    user_id bigint NOT NULL,
    farm_name character varying(100) NOT NULL,
    location character varying(255),
    crop_type character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.farms OWNER TO leafy_ai;

--
-- Name: sensors; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.sensors (
    sensor_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    sensor_type character varying(50) NOT NULL,
    unit character varying(20),
    status character varying(20),
    installed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sensors OWNER TO leafy_ai;

--
-- Name: farm_monitoring_summary; Type: VIEW; Schema: public; Owner: leafy_ai
--

CREATE VIEW public.farm_monitoring_summary AS
 SELECT f.farm_name,
    s.sensor_type,
    sr.value,
    s.unit,
    sr.recorded_at,
        CASE
            WHEN (((s.sensor_type)::text = 'Temperature'::text) AND ((sr.value < (20)::double precision) OR (sr.value > (30)::double precision))) THEN 'ALERT'::text
            WHEN (((s.sensor_type)::text = 'pH'::text) AND ((sr.value < (5.5)::double precision) OR (sr.value > (7.0)::double precision))) THEN 'ALERT'::text
            WHEN (((s.sensor_type)::text = 'Humidity'::text) AND ((sr.value < (50)::double precision) OR (sr.value > (80)::double precision))) THEN 'ALERT'::text
            ELSE 'OK'::text
        END AS sensor_status,
        CASE
            WHEN (((s.sensor_type)::text = 'Temperature'::text) AND ((sr.value < (20)::double precision) OR (sr.value > (30)::double precision))) THEN 'Check greenhouse temperature and increase ventilation or cooling.'::text
            WHEN (((s.sensor_type)::text = 'pH'::text) AND ((sr.value < (5.5)::double precision) OR (sr.value > (7.0)::double precision))) THEN 'Check soil pH and consider adjusting soil acidity.'::text
            WHEN (((s.sensor_type)::text = 'Humidity'::text) AND ((sr.value < (50)::double precision) OR (sr.value > (80)::double precision))) THEN 'Check irrigation and ventilation to bring humidity back to the normal range.'::text
            ELSE 'No action required.'::text
        END AS recommended_action
   FROM ((public.sensor_readings sr
     JOIN public.sensors s ON ((sr.sensor_id = s.sensor_id)))
     JOIN public.farms f ON ((s.farm_id = f.farm_id)))
  WHERE (sr.recorded_at = ( SELECT max(sr2.recorded_at) AS max
           FROM public.sensor_readings sr2
          WHERE (sr2.sensor_id = sr.sensor_id)));


ALTER VIEW public.farm_monitoring_summary OWNER TO leafy_ai;

--
-- Name: farm_tasks; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.farm_tasks (
    task_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    task_name character varying(100),
    description text,
    scheduled_at timestamp with time zone,
    status character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.farm_tasks OWNER TO leafy_ai;

--
-- Name: farm_tasks_task_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.farm_tasks_task_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.farm_tasks_task_id_seq OWNER TO leafy_ai;

--
-- Name: farm_tasks_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.farm_tasks_task_id_seq OWNED BY public.farm_tasks.task_id;


--
-- Name: farms_farm_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.farms_farm_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.farms_farm_id_seq OWNER TO leafy_ai;

--
-- Name: farms_farm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.farms_farm_id_seq OWNED BY public.farms.farm_id;


--
-- Name: plant_images; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.plant_images (
    image_id bigint NOT NULL,
    farm_id bigint NOT NULL,
    image_path text NOT NULL,
    captured_at timestamp with time zone DEFAULT now(),
    analysis_status character varying(30),
    camera_id bigint
);


ALTER TABLE public.plant_images OWNER TO leafy_ai;

--
-- Name: plant_images_image_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.plant_images_image_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plant_images_image_id_seq OWNER TO leafy_ai;

--
-- Name: plant_images_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.plant_images_image_id_seq OWNED BY public.plant_images.image_id;


--
-- Name: sensor_readings_reading_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.sensor_readings_reading_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sensor_readings_reading_id_seq OWNER TO leafy_ai;

--
-- Name: sensor_readings_reading_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.sensor_readings_reading_id_seq OWNED BY public.sensor_readings.reading_id;


--
-- Name: sensors_sensor_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.sensors_sensor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sensors_sensor_id_seq OWNER TO leafy_ai;

--
-- Name: sensors_sensor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.sensors_sensor_id_seq OWNED BY public.sensors.sensor_id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: leafy_ai
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO leafy_ai;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: leafy_ai
--

CREATE SEQUENCE public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO leafy_ai;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: leafy_ai
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: _hyper_2_2_chunk reading_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: leafy_ai
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_2_chunk ALTER COLUMN reading_id SET DEFAULT nextval('public.sensor_readings_reading_id_seq'::regclass);


--
-- Name: ai_recommendations recommendation_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.ai_recommendations ALTER COLUMN recommendation_id SET DEFAULT nextval('public.ai_recommendations_recommendation_id_seq'::regclass);


--
-- Name: audit_logs log_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN log_id SET DEFAULT nextval('public.audit_logs_log_id_seq'::regclass);


--
-- Name: cameras camera_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.cameras ALTER COLUMN camera_id SET DEFAULT nextval('public.cameras_camera_id_seq'::regclass);


--
-- Name: farm_tasks task_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farm_tasks ALTER COLUMN task_id SET DEFAULT nextval('public.farm_tasks_task_id_seq'::regclass);


--
-- Name: farms farm_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farms ALTER COLUMN farm_id SET DEFAULT nextval('public.farms_farm_id_seq'::regclass);


--
-- Name: plant_images image_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.plant_images ALTER COLUMN image_id SET DEFAULT nextval('public.plant_images_image_id_seq'::regclass);


--
-- Name: sensor_readings reading_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensor_readings ALTER COLUMN reading_id SET DEFAULT nextval('public.sensor_readings_reading_id_seq'::regclass);


--
-- Name: sensors sensor_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensors ALTER COLUMN sensor_id SET DEFAULT nextval('public.sensors_sensor_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Data for Name: hypertable; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.hypertable (id, schema_name, table_name, associated_schema_name, associated_table_prefix, num_dimensions, chunk_sizing_func_schema, chunk_sizing_func_name, chunk_target_size, compression_state, compressed_hypertable_id, status) FROM stdin;
2	public	sensor_readings	_timescaledb_internal	_hyper_2	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
\.


--
-- Data for Name: bgw_job; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.bgw_job (id, application_name, schedule_interval, max_runtime, max_retries, retry_period, proc_schema, proc_name, owner, scheduled, fixed_schedule, initial_start, hypertable_id, config, check_schema, check_name, timezone) FROM stdin;
\.


--
-- Data for Name: chunk; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.chunk (id, relid, hypertable_id, status, osm_chunk, creation_time) FROM stdin;
2	_timescaledb_internal._hyper_2_2_chunk	2	0	f	2026-08-09 08:17:52.271989+00
\.


--
-- Data for Name: chunk_column_stats; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.chunk_column_stats (id, hypertable_id, chunk_id, column_name, range_start, range_end, valid) FROM stdin;
\.


--
-- Data for Name: compression_chunk_size; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.compression_chunk_size (chunk_id, compressed_chunk_id, uncompressed_heap_size, uncompressed_toast_size, uncompressed_index_size, compressed_heap_size, compressed_toast_size, compressed_index_size, numrows_pre_compression, numrows_post_compression, numrows_frozen_immediately) FROM stdin;
\.


--
-- Data for Name: compression_settings; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.compression_settings (relid, compress_relid, segmentby, orderby, orderby_desc, orderby_nullsfirst, index) FROM stdin;
\.


--
-- Data for Name: continuous_agg; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_agg (mat_hypertable_id, raw_hypertable_id, parent_mat_hypertable_id, user_view_schema, user_view_name, partial_view_schema, partial_view_name, direct_view_schema, direct_view_name, materialized_only, schema_change_timestamp) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_bucket_function; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_bucket_function (mat_hypertable_id, bucket_func, bucket_width, bucket_origin, bucket_offset, bucket_timezone, bucket_fixed_width) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_hypertable_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_hypertable_invalidation_log (hypertable_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_invalidation_threshold; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_invalidation_threshold (hypertable_id, watermark) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_jobs_refresh_ranges; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_jobs_refresh_ranges (materialization_id, start_range, end_range, pid, job_id, created_at) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_materialization_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_materialization_invalidation_log (materialization_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_materialization_ranges; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_materialization_ranges (materialization_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_tenant_tracking; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_tenant_tracking (hypertable_id, tenant_id, min_timestamp, max_timestamp, seqnum) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_watermark; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.continuous_aggs_watermark (mat_hypertable_id, watermark) FROM stdin;
\.


--
-- Data for Name: dimension; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.dimension (id, hypertable_id, column_name, column_type, aligned, num_slices, partitioning_func_schema, partitioning_func, interval_length, compress_interval_length, integer_now_func_schema, integer_now_func) FROM stdin;
2	2	recorded_at	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
\.


--
-- Data for Name: dimension_slice; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.dimension_slice (id, chunk_id, dimension_id, range_start, range_end) FROM stdin;
2	2	2	1785974400000000	1786579200000000
\.


--
-- Data for Name: hypertable_cagg_settings; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.hypertable_cagg_settings (hypertable_id, granular_refresh_column, granular_refresh_start_offset, granular_refresh_end_offset) FROM stdin;
\.


--
-- Data for Name: metadata; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.metadata (key, value, include_in_telemetry) FROM stdin;
install_timestamp	2026-08-09 06:50:24.402687+00	t
timescaledb_version	2.29.1	f
exported_uuid	e63fa4dc-f74d-457f-a12c-7a80afa3d4e1	t
\.


--
-- Data for Name: tablespace; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: leafy_ai
--

COPY _timescaledb_catalog.tablespace (id, hypertable_id, tablespace_name) FROM stdin;
\.


--
-- Data for Name: _hyper_2_2_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: leafy_ai
--

COPY _timescaledb_internal._hyper_2_2_chunk (reading_id, sensor_id, recorded_at, value, quality_status) FROM stdin;
1	1	2026-08-09 07:47:52.259069+00	24.5	valid
3	1	2026-08-09 08:07:52.259069+00	25.1	valid
4	1	2026-08-09 08:17:52.259069+00	25	valid
5	2	2026-08-09 07:47:52.259069+00	6.1	valid
6	2	2026-08-09 07:57:52.259069+00	6.2	valid
7	2	2026-08-09 08:07:52.259069+00	6.3	valid
9	3	2026-08-09 07:47:52.259069+00	68	valid
10	3	2026-08-09 07:57:52.259069+00	69	valid
11	3	2026-08-09 08:07:52.259069+00	70	valid
12	3	2026-08-09 08:17:52.259069+00	69.5	valid
13	1	2026-08-09 09:32:47.590569+00	35	valid
2	1	2026-08-09 07:57:52.259069+00	7.5	valid
8	2	2026-08-09 08:17:52.259069+00	7.5	valid
\.


--
-- Data for Name: ai_recommendations; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.ai_recommendations (recommendation_id, farm_id, recommendation_type, message, risk_level, status, created_at, reviewed_at, reviewed_by) FROM stdin;
4	1	pH	Check soil pH and consider adjusting soil acidity.	Medium	Reviewed	2026-08-09 10:28:57.067991+00	2026-08-09 10:34:43.684122+00	\N
3	1	Temperature	Check greenhouse temperature and increase ventilation or cooling.	High	Reviewed	2026-08-09 10:07:28.147437+00	2026-08-09 11:32:49.597519+00	1
2	1	Temperature	Check greenhouse temperature and increase ventilation or cooling.	High	Reviewed	2026-08-09 09:47:50.555553+00	2026-08-09 11:34:05.369003+00	1
1	1	Irrigation	Soil conditions should be monitored and irrigation adjusted if moisture decreases.	medium	Reviewed	2026-08-09 08:24:43.750975+00	2026-08-09 11:35:11.216011+00	1
5	1	Temperature	Check greenhouse temperature and increase ventilation or cooling.	High	Pending	2026-08-09 11:44:42.308078+00	\N	\N
6	1	pH	Check soil pH and consider adjusting soil acidity.	Medium	Pending	2026-08-09 11:44:42.308078+00	\N	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.audit_logs (log_id, user_id, farm_id, action_type, description, created_at) FROM stdin;
1	1	1	CREATE_RECOMMENDATION	AI irrigation recommendation created for the basil farm.	2026-08-09 08:26:54.731245+00
\.


--
-- Data for Name: cameras; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.cameras (camera_id, farm_id, camera_type, location_description, status, installed_at) FROM stdin;
1	1	Plant Health Camera	Basil growing area	active	2026-08-09 08:11:52.575852+00
\.


--
-- Data for Name: farm_tasks; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.farm_tasks (task_id, farm_id, task_name, description, scheduled_at, status, created_at) FROM stdin;
1	1	Check basil irrigation	Review current sensor readings and check irrigation conditions.	2026-08-09 10:26:07.486092+00	pending	2026-08-09 08:26:07.486092+00
\.


--
-- Data for Name: farms; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.farms (farm_id, user_id, farm_name, location, crop_type, created_at) FROM stdin;
1	1	Leafy AI Demo Farm	Melbourne, Australia	Basil	2026-08-09 08:10:06.796887+00
\.


--
-- Data for Name: plant_images; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.plant_images (image_id, farm_id, image_path, captured_at, analysis_status, camera_id) FROM stdin;
1	1	/images/basil_sample_001.jpg	2026-08-09 08:22:55.317043+00	pending	1
2	1	/images/basil_sample_001.jpg	2026-08-09 08:22:55.479752+00	pending	1
3	1	/images/basil_sample_001.jpg	2026-08-09 08:22:58.571014+00	pending	1
\.


--
-- Data for Name: sensor_readings; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.sensor_readings (reading_id, sensor_id, recorded_at, value, quality_status) FROM stdin;
\.


--
-- Data for Name: sensors; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.sensors (sensor_id, farm_id, sensor_type, unit, status, installed_at) FROM stdin;
1	1	Temperature	°C	active	2026-08-09 08:11:10.347473+00
2	1	pH	pH	active	2026-08-09 08:11:10.347473+00
3	1	Humidity	%	active	2026-08-09 08:11:10.347473+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: leafy_ai
--

COPY public.users (user_id, full_name, email, password_hash, role, created_at) FROM stdin;
1	Demo Farm Manager	demo@leafyai.com	demo_password_hash	manager	2026-08-09 08:09:24.696865+00
\.


--
-- Name: bgw_job_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.bgw_job_id_seq', 1000, false);


--
-- Name: chunk_column_stats_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_column_stats_id_seq', 1, false);


--
-- Name: chunk_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_id_seq', 2, true);


--
-- Name: dimension_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_id_seq', 2, true);


--
-- Name: dimension_slice_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_slice_id_seq', 2, true);


--
-- Name: hypertable_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: leafy_ai
--

SELECT pg_catalog.setval('_timescaledb_catalog.hypertable_id_seq', 2, true);


--
-- Name: ai_recommendations_recommendation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.ai_recommendations_recommendation_id_seq', 6, true);


--
-- Name: audit_logs_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.audit_logs_log_id_seq', 1, true);


--
-- Name: cameras_camera_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.cameras_camera_id_seq', 1, true);


--
-- Name: farm_tasks_task_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.farm_tasks_task_id_seq', 1, true);


--
-- Name: farms_farm_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.farms_farm_id_seq', 1, true);


--
-- Name: plant_images_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.plant_images_image_id_seq', 3, true);


--
-- Name: sensor_readings_reading_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.sensor_readings_reading_id_seq', 13, true);


--
-- Name: sensors_sensor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.sensors_sensor_id_seq', 3, true);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: leafy_ai
--

SELECT pg_catalog.setval('public.users_user_id_seq', 1, true);


--
-- Name: _hyper_2_2_chunk 2_sensor_readings_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: leafy_ai
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_2_chunk
    ADD CONSTRAINT "2_sensor_readings_pkey" PRIMARY KEY (reading_id, recorded_at);


--
-- Name: ai_recommendations ai_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_pkey PRIMARY KEY (recommendation_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id);


--
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (camera_id);


--
-- Name: farm_tasks farm_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farm_tasks
    ADD CONSTRAINT farm_tasks_pkey PRIMARY KEY (task_id);


--
-- Name: farms farms_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_pkey PRIMARY KEY (farm_id);


--
-- Name: plant_images plant_images_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.plant_images
    ADD CONSTRAINT plant_images_pkey PRIMARY KEY (image_id);


--
-- Name: sensor_readings sensor_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (reading_id, recorded_at);


--
-- Name: sensors sensors_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_pkey PRIMARY KEY (sensor_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: _hyper_2_2_chunk_sensor_readings_recorded_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: leafy_ai
--

CREATE INDEX _hyper_2_2_chunk_sensor_readings_recorded_at_idx ON _timescaledb_internal._hyper_2_2_chunk USING btree (recorded_at DESC);


--
-- Name: sensor_readings_recorded_at_idx; Type: INDEX; Schema: public; Owner: leafy_ai
--

CREATE INDEX sensor_readings_recorded_at_idx ON public.sensor_readings USING btree (recorded_at DESC);


--
-- Name: _hyper_2_2_chunk sensor_readings_sensor_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: leafy_ai
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_2_chunk
    ADD CONSTRAINT sensor_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(sensor_id);


--
-- Name: ai_recommendations ai_recommendations_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: ai_recommendations ai_recommendations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);


--
-- Name: audit_logs audit_logs_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: cameras cameras_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: farm_tasks farm_tasks_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farm_tasks
    ADD CONSTRAINT farm_tasks_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: farms farms_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: plant_images plant_images_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.plant_images
    ADD CONSTRAINT plant_images_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(camera_id);


--
-- Name: plant_images plant_images_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.plant_images
    ADD CONSTRAINT plant_images_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- Name: sensor_readings sensor_readings_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(sensor_id);


--
-- Name: sensors sensors_farm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: leafy_ai
--

ALTER TABLE ONLY public.sensors
    ADD CONSTRAINT sensors_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(farm_id);


--
-- PostgreSQL database dump complete
--

\unrestrict APP3JytaCBK8KNaucImz1cCxOHSJPfxS1rY2iBbEfRWbnw0jyDAmZezSuQUYDpc

