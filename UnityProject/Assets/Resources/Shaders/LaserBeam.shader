Shader "Custom/LaserBeam"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _Core ("Core Sharpness", Range(1, 8)) = 3
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        LOD 100

        // Blend cong: tia laser chi cong sang vao canh phia sau, khong che.
        Blend SrcAlpha One
        ZWrite Off
        Cull Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata_t
            {
                float4 vertex : POSITION;
                float4 color : COLOR;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                fixed4 color : COLOR;
                float2 texcoord : TEXCOORD0;
            };

            fixed4 _Color;
            float _Core;

            v2f vert (appdata_t v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                // LineRenderer dua startColor/endColor vao day duoi dang mau dinh.
                o.color = v.color * _Color;
                o.texcoord = v.texcoord;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // v chay ngang be rong tia: sang gat o loi, tat dan ra hai mep.
                float across = 1.0 - saturate(abs(i.texcoord.y - 0.5) * 2.0);
                float glow = pow(across, _Core);

                fixed4 col = i.color;
                col.a *= glow;
                return col;
            }
            ENDCG
        }
    }
    Fallback Off
}
