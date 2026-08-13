Shader "Custom/LightPool"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _Softness ("Edge Softness", Range(0.5, 5)) = 2.2
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        LOD 100

        // Blend cong: mau cua quad duoc CONG vao nhung gi da ve truoc do.
        // Nho vay vung sang chi lam sang them anh nen chu khong bao gio che no,
        // khac han mot mat san duc.
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
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 texcoord : TEXCOORD0;
            };

            fixed4 _Color;
            float _Softness;

            v2f vert (appdata_t v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.texcoord = v.texcoord;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Vung sang hinh elip, mo dan tu tam ra vien
                float2 d = i.texcoord - float2(0.5, 0.5);
                float dist = saturate(length(d) * 2.0);
                float falloff = pow(saturate(1.0 - dist), _Softness);

                fixed4 col = _Color;
                col.a *= falloff;
                return col;
            }
            ENDCG
        }
    }
    Fallback Off
}
